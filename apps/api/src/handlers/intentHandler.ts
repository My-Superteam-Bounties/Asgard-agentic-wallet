/**
 * intentHandler.ts
 * The core routing layer for agent transaction intents.
 *
 * Flow:
 *   Agent Intent → Policy Check → Build Transaction → Vault Signs → Kora Sponsors Gas → Broadcast
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
    PublicKey,
    SystemProgram,
    LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
    createTransferCheckedInstruction,
    getAssociatedTokenAddress,
    getMint,
} from '@solana/spl-token';
import { Keypair } from '@solana/web3.js';
import { AsgardVault } from '../vault/AsgardVault';
import { PolicyEngine } from '../policy/PolicyEngine';
import { requireAgentAuth } from '../middleware/auth';
import {
    getSwapQuote,
    buildSwapTransaction,
    resolveMint,
    toRawAmount,
} from '../services/JupiterService';

// ─── Validation Schemas ─────────────────────────────────────────────────────

const SwapIntentSchema = z.object({
    inputToken: z.string(),
    outputToken: z.string(),
    amount: z.number().positive(),
    slippageBps: z.number().int().min(1).max(1000).default(50),
});

const TransferIntentSchema = z.object({
    token: z.string().default('SOL'),
    amount: z.number().positive(),
    destination: z.string().min(32).max(44),
});

// ─── Helper: get Kora feePayer keypair from env ──────────────────────────────

function getKoraSponsorKeypair(): Keypair {
    const key = process.env.KORA_SPONSOR_PRIVATE_KEY;
    if (!key) throw new Error('KORA_SPONSOR_PRIVATE_KEY is not set in environment.');
    // Support both base58 and base64 encoded keys
    try {
        // Try as a JSON array first (solana-keygen format)
        const arr = JSON.parse(key) as number[];
        return Keypair.fromSecretKey(Uint8Array.from(arr));
    } catch {
        // Fall back to base64
        const bytes = Buffer.from(key, 'base64');
        return Keypair.fromSecretKey(bytes);
    }
}

// ─── Router Factory ──────────────────────────────────────────────────────────

export function createIntentRouter(vault: AsgardVault, policy: PolicyEngine): Router {
    const router = Router();
    const connection = vault.getConnection();

    // ─── POST /v1/intent/swap ─────────────────────────────────────────────────

    /**
     * Executes a token swap via Jupiter v6 on behalf of an agent.
     * Gas is sponsored by the Kora node — agent needs no SOL.
     */
    router.post('/swap', requireAgentAuth, async (req: Request, res: Response) => {
        try {
            const agent = req.agent!;
            const parsed = SwapIntentSchema.safeParse(req.body);

            if (!parsed.success) {
                res.status(400).json({ error: 'ValidationError', details: parsed.error.issues });
                return;
            }

            const { inputToken, outputToken, amount, slippageBps } = parsed.data;

            // 1. Run the intent through the Policy Engine
            const policyResult = policy.evaluate(agent.agentId, agent.policyProfile, {
                action: 'SWAP',
                inputToken,
                outputToken,
                amount,
            });

            if (!policyResult.allowed) {
                res.status(403).json({ error: 'PolicyViolation', ...policyResult.violation });
                return;
            }

            // 2. Fetch swap quote from Jupiter
            const quote = await getSwapQuote(inputToken, outputToken, amount, slippageBps);

            // 3. Build the swap transaction (with Kora feePayer)
            const agentPublicKey = vault.getAgentPublicKey(agent.agentId);
            const sponsorKeypair = getKoraSponsorKeypair();

            const swapTx = await buildSwapTransaction(
                quote,
                agentPublicKey,
                sponsorKeypair.publicKey
            );

            // 4. Sign with the agent's vault key (transiently decrypted, zeroed after)
            const agentSignedTx = await vault.signTransaction(agent.agentId, swapTx);

            // 5. Co-sign with Kora sponsor as feePayer
            agentSignedTx.sign([sponsorKeypair]);

            // 6. Broadcast to Solana
            const rawTx = agentSignedTx.serialize();
            const signature = await connection.sendRawTransaction(rawTx, {
                skipPreflight: false,
                maxRetries: 3,
            });

            await connection.confirmTransaction(signature, 'confirmed');

            // 7. Record usage after confirmed broadcast
            policy.recordUsage(agent.agentId, amount);

            res.json({
                status: 'success',
                signature,
                inputAmount: amount,
                inputToken,
                outputAmount: quote.outputAmount,
                outputToken,
                priceImpactPct: quote.priceImpactPct,
                explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=${process.env.SOLANA_NETWORK || 'devnet'}`,
            });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            res.status(500).json({ error: 'SwapFailed', message });
        }
    });

    // ─── POST /v1/intent/transfer ─────────────────────────────────────────────

    /**
     * Transfers SOL or an SPL token to another address.
     */
    router.post('/transfer', requireAgentAuth, async (req: Request, res: Response) => {
        try {
            const agent = req.agent!;
            const parsed = TransferIntentSchema.safeParse(req.body);

            if (!parsed.success) {
                res.status(400).json({ error: 'ValidationError', details: parsed.error.issues });
                return;
            }

            const { token, amount, destination } = parsed.data;

            // 1. Policy check
            const policyResult = policy.evaluate(agent.agentId, agent.policyProfile, {
                action: 'TRANSFER',
                token,
                amount,
                destination,
            });

            if (!policyResult.allowed) {
                res.status(403).json({ error: 'PolicyViolation', ...policyResult.violation });
                return;
            }

            const agentPublicKey = vault.getAgentPublicKey(agent.agentId);
            const destinationKey = new PublicKey(destination);
            const sponsorKeypair = getKoraSponsorKeypair();

            let transferInstruction;

            if (token === 'SOL') {
                // Native SOL transfer
                transferInstruction = SystemProgram.transfer({
                    fromPubkey: agentPublicKey,
                    toPubkey: destinationKey,
                    lamports: Math.floor(amount * LAMPORTS_PER_SOL),
                });
            } else {
                // SPL token transfer
                const mintAddress = new PublicKey(resolveMint(token));
                const mintInfo = await getMint(connection, mintAddress);
                const sourceAta = await getAssociatedTokenAddress(mintAddress, agentPublicKey);
                const destAta = await getAssociatedTokenAddress(mintAddress, destinationKey);

                const rawAmount = BigInt(toRawAmount(amount, token));
                transferInstruction = createTransferCheckedInstruction(
                    sourceAta,
                    mintAddress,
                    destAta,
                    agentPublicKey,
                    rawAmount,
                    mintInfo.decimals
                );
            }

            // 2. Build versioned transaction with Kora feePayer
            const tx = await vault.buildTransaction(sponsorKeypair.publicKey, [
                transferInstruction,
            ]);

            // 3. Sign with agent vault key
            const signedTx = await vault.signTransaction(agent.agentId, tx);

            // 4. Co-sign with Kora sponsor
            signedTx.sign([sponsorKeypair]);

            // 5. Broadcast
            const rawTx = signedTx.serialize();
            const signature = await connection.sendRawTransaction(rawTx, {
                skipPreflight: false,
                maxRetries: 3,
            });

            await connection.confirmTransaction(signature, 'confirmed');

            // 6. Record usage
            policy.recordUsage(agent.agentId, amount);

            res.json({
                status: 'success',
                signature,
                token,
                amount,
                destination,
                explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=${process.env.SOLANA_NETWORK || 'devnet'}`,
            });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            res.status(500).json({ error: 'TransferFailed', message });
        }
    });

    return router;
}
