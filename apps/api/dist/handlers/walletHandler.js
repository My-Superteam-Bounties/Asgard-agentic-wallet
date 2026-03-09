"use strict";
/**
 * walletHandler.ts
 * Routes for querying an agent's on-chain wallet state.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWalletRouter = createWalletRouter;
const express_1 = require("express");
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const auth_1 = require("../middleware/auth");
const JupiterService_1 = require("../services/JupiterService");
const eventBus_1 = require("../eventBus");
const TRACKED_TOKENS = ['USDC', 'BONK'];
function createWalletRouter(vault) {
    const router = (0, express_1.Router)();
    /**
     * GET /v1/wallet/:agentId/balance
     * Returns the SOL and SPL token balances for an agent's wallet.
     */
    router.get('/:agentId/balance', auth_1.requireAgentAuth, async (req, res) => {
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
            const solBalance = lamports / web3_js_1.LAMPORTS_PER_SOL;
            // Fetch SPL token balances
            const tokenBalances = {};
            for (const ticker of TRACKED_TOKENS) {
                const mint = new web3_js_1.PublicKey(JupiterService_1.TOKEN_MINTS[ticker]);
                try {
                    const ata = await (0, spl_token_1.getAssociatedTokenAddress)(mint, publicKey);
                    const account = await (0, spl_token_1.getAccount)(connection, ata);
                    const decimals = (0, JupiterService_1.getDecimals)(ticker);
                    tokenBalances[ticker] = Number(account.amount) / Math.pow(10, decimals);
                }
                catch {
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
            eventBus_1.eventBus.emitEvent('wallet:balance:queried', {
                agentId,
                address: publicKey.toBase58(),
                balances: { SOL: solBalance, ...tokenBalances },
            });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            res.status(500).json({ error: 'BalanceFetchFailed', message });
        }
    });
    /**
     * GET /v1/wallet/:agentId/history
     * Returns the recent transaction history for the agent's wallet.
     */
    router.get('/:agentId/history', auth_1.requireAgentAuth, async (req, res) => {
        try {
            const { agentId } = req.params;
            const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
            if (req.agent?.agentId !== agentId) {
                res.status(403).json({ error: 'Forbidden', message: 'Agents can only query their own wallet.' });
                return;
            }
            const connection = vault.getConnection();
            const publicKey = vault.getAgentPublicKey(agentId);
            // Fetch the last 'limit' signatures for this address
            const signatures = await connection.getSignaturesForAddress(publicKey, { limit });
            // In a production app, we would parse each parsed transaction for a human/AI-readable
            // summary of the events (e.g. "Swapped 10 USDC for 0.05 SOL"). For now, we return the signatures.
            const history = signatures.map(sig => ({
                signature: sig.signature,
                slot: sig.slot,
                err: sig.err,
                memo: sig.memo,
                blockTime: sig.blockTime ? new Date(sig.blockTime * 1000).toISOString() : null,
                explorerUrl: `https://explorer.solana.com/tx/${sig.signature}?cluster=${process.env.SOLANA_NETWORK || 'devnet'}`
            }));
            res.json({
                agentId,
                address: publicKey.toBase58(),
                history,
                timestamp: new Date().toISOString()
            });
            eventBus_1.eventBus.emitEvent('wallet:history:queried', {
                agentId,
                address: publicKey.toBase58(),
                transactionCount: history.length,
            });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            res.status(500).json({ error: 'HistoryFetchFailed', message });
        }
    });
    return router;
}
//# sourceMappingURL=walletHandler.js.map