"use strict";
/**
 * intentHandler.ts
 * The core routing layer for agent transaction intents.
 *
 * Flow:
 *   Agent Intent → Policy Check → Build Transaction → Vault Signs → Kora Sponsors Gas → Broadcast
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createIntentRouter = createIntentRouter;
const express_1 = require("express");
const zod_1 = require("zod");
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const auth_1 = require("../middleware/auth");
const JupiterService_1 = require("../services/JupiterService");
const eventBus_1 = require("../eventBus");
// ─── Validation Schemas ─────────────────────────────────────────────────────
const SwapIntentSchema = zod_1.z.object({
    inputToken: zod_1.z.string(),
    outputToken: zod_1.z.string(),
    amount: zod_1.z.number().positive(),
    slippageBps: zod_1.z.number().int().min(1).max(1000).default(50),
});
const TransferIntentSchema = zod_1.z.object({
    token: zod_1.z.string().default('SOL'),
    amount: zod_1.z.number().positive(),
    destination: zod_1.z.string().min(32).max(44),
});
const KoraClient_1 = require("../services/KoraClient");
// ─── Router Factory ──────────────────────────────────────────────────────────
function createIntentRouter(vault, policy) {
    const router = (0, express_1.Router)();
    const connection = vault.getConnection();
    // ─── POST /v1/intent/swap ─────────────────────────────────────────────────
    /**
     * Executes a token swap via Jupiter v6 on behalf of an agent.
     * Gas is sponsored by the Kora node — agent needs no SOL.
     */
    router.post('/swap', auth_1.requireAgentAuth, async (req, res) => {
        try {
            const agent = req.agent;
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
                eventBus_1.eventBus.emitEvent('policy:violation', {
                    agentId: agent.agentId,
                    agentName: agent.name,
                    action: 'SWAP',
                    inputToken,
                    outputToken,
                    amount,
                    violation: policyResult.violation,
                });
                res.status(403).json({ error: 'PolicyViolation', ...policyResult.violation });
                return;
            }
            // Emit pending event
            eventBus_1.eventBus.emitEvent('intent:swap:pending', {
                agentId: agent.agentId,
                agentName: agent.name,
                inputToken,
                outputToken,
                amount,
            });
            // 2. Fetch swap quote from Jupiter
            const quote = await (0, JupiterService_1.getSwapQuote)(inputToken, outputToken, amount, slippageBps);
            // 3. Build the swap transaction (with Kora feePayer from RPC)
            const agentPublicKey = vault.getAgentPublicKey(agent.agentId);
            const payerPubkeyBase58 = await KoraClient_1.koraClient.getPayerSigner();
            const sponsorPublicKey = new web3_js_1.PublicKey(payerPubkeyBase58);
            const swapTx = await (0, JupiterService_1.buildSwapTransaction)(quote, agentPublicKey, sponsorPublicKey);
            // 4. Sign with the agent's vault key (transiently decrypted, zeroed after)
            const agentSignedTx = await vault.signTransaction(agent.agentId, swapTx);
            // 5. Send to Kora Paymaster for co-signing and broadcast
            const rawTxBase64 = Buffer.from(agentSignedTx.serialize()).toString('base64');
            const signature = await KoraClient_1.koraClient.signAndSendTransaction(rawTxBase64);
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
            eventBus_1.eventBus.emitEvent('intent:swap:success', {
                agentId: agent.agentId,
                agentName: agent.name,
                signature,
                inputAmount: amount,
                inputToken,
                outputAmount: quote.outputAmount,
                outputToken,
                priceImpactPct: quote.priceImpactPct,
                explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=${process.env.SOLANA_NETWORK || 'devnet'}`,
            });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            eventBus_1.eventBus.emitEvent('intent:swap:failed', {
                agentId: req.agent?.agentId,
                agentName: req.agent?.name,
                error: message,
            });
            res.status(500).json({ error: 'SwapFailed', message });
        }
    });
    // ─── POST /v1/intent/transfer ─────────────────────────────────────────────
    /**
     * Transfers SOL or an SPL token to another address.
     */
    router.post('/transfer', auth_1.requireAgentAuth, async (req, res) => {
        try {
            const agent = req.agent;
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
                eventBus_1.eventBus.emitEvent('policy:violation', {
                    agentId: agent.agentId,
                    agentName: agent.name,
                    action: 'TRANSFER',
                    token,
                    amount,
                    destination,
                    violation: policyResult.violation,
                });
                res.status(403).json({ error: 'PolicyViolation', ...policyResult.violation });
                return;
            }
            // Emit pending event
            eventBus_1.eventBus.emitEvent('intent:transfer:pending', {
                agentId: agent.agentId,
                agentName: agent.name,
                token,
                amount,
                destination,
            });
            const agentPublicKey = vault.getAgentPublicKey(agent.agentId);
            const destinationKey = new web3_js_1.PublicKey(destination);
            const payerPubkeyBase58 = await KoraClient_1.koraClient.getPayerSigner();
            const sponsorPublicKey = new web3_js_1.PublicKey(payerPubkeyBase58);
            let transferInstruction;
            if (token === 'SOL') {
                // Native SOL transfer
                transferInstruction = web3_js_1.SystemProgram.transfer({
                    fromPubkey: agentPublicKey,
                    toPubkey: destinationKey,
                    lamports: Math.floor(amount * web3_js_1.LAMPORTS_PER_SOL),
                });
            }
            else {
                // SPL token transfer
                const mintAddress = new web3_js_1.PublicKey((0, JupiterService_1.resolveMint)(token));
                const mintInfo = await (0, spl_token_1.getMint)(connection, mintAddress);
                const sourceAta = await (0, spl_token_1.getAssociatedTokenAddress)(mintAddress, agentPublicKey);
                const destAta = await (0, spl_token_1.getAssociatedTokenAddress)(mintAddress, destinationKey);
                const rawAmount = BigInt((0, JupiterService_1.toRawAmount)(amount, token));
                transferInstruction = (0, spl_token_1.createTransferCheckedInstruction)(sourceAta, mintAddress, destAta, agentPublicKey, rawAmount, mintInfo.decimals);
            }
            // 2. Build versioned transaction with Kora feePayer
            const tx = await vault.buildTransaction(sponsorPublicKey, [
                transferInstruction,
            ]);
            // 3. Sign with agent vault key
            const signedTx = await vault.signTransaction(agent.agentId, tx);
            // 4. Send to Kora Paymaster for co-signing and broadcast
            const rawTxBase64 = Buffer.from(signedTx.serialize()).toString('base64');
            const signature = await KoraClient_1.koraClient.signAndSendTransaction(rawTxBase64);
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
            eventBus_1.eventBus.emitEvent('intent:transfer:success', {
                agentId: agent.agentId,
                agentName: agent.name,
                signature,
                token,
                amount,
                destination,
                explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=${process.env.SOLANA_NETWORK || 'devnet'}`,
            });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            eventBus_1.eventBus.emitEvent('intent:transfer:failed', {
                agentId: req.agent?.agentId,
                agentName: req.agent?.name,
                error: message,
            });
            res.status(500).json({ error: 'TransferFailed', message });
        }
    });
    return router;
}
//# sourceMappingURL=intentHandler.js.map