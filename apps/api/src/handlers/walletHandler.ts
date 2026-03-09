/**
 * walletHandler.ts
 * Routes for querying an agent's on-chain wallet state.
 */

import { Router, Request, Response } from 'express';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import { AsgardVault } from '../vault/AsgardVault';
import { requireAgentAuth } from '../middleware/auth';
import { TOKEN_MINTS, getDecimals } from '../services/JupiterService';

const TRACKED_TOKENS = ['USDC', 'BONK'] as const;

export function createWalletRouter(vault: AsgardVault): Router {
    const router = Router();

    /**
     * GET /v1/wallet/:agentId/balance
     * Returns the SOL and SPL token balances for an agent's wallet.
     */
    router.get('/:agentId/balance', requireAgentAuth, async (req: Request, res: Response) => {
        try {
            const { agentId } = req.params;

            // Agents can only query their own wallet
            if (req.agent?.agentId !== agentId) {
                res.status(403).json({ error: 'Forbidden', message: 'Agents can only query their own wallet.' });
                return;
            }

            const connection = vault.getConnection();
            const publicKey = vault.getAgentPublicKey(agentId);

            // Fetch native SOL balance
            const lamports = await connection.getBalance(publicKey);
            const solBalance = lamports / LAMPORTS_PER_SOL;

            // Fetch SPL token balances
            const tokenBalances: Record<string, number> = {};

            for (const ticker of TRACKED_TOKENS) {
                const mint = new PublicKey(TOKEN_MINTS[ticker]);
                try {
                    const ata = await getAssociatedTokenAddress(mint, publicKey);
                    const account = await getAccount(connection, ata);
                    const decimals = getDecimals(ticker);
                    tokenBalances[ticker] = Number(account.amount) / Math.pow(10, decimals);
                } catch {
                    // Associated token account doesn't exist yet — balance is 0
                    tokenBalances[ticker] = 0;
                }
            }

            res.json({
                agentId,
                address: publicKey.toBase58(),
                balances: {
                    SOL: solBalance,
                    ...tokenBalances,
                },
                timestamp: new Date().toISOString(),
            });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            res.status(500).json({ error: 'BalanceFetchFailed', message });
        }
    });

    return router;
}
