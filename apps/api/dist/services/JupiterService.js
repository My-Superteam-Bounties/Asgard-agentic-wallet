"use strict";
/**
 * JupiterService.ts
 * Integrates with the Jupiter v6 Swap API to build swap transactions for agents.
 * Jupiter is the leading DEX aggregator on Solana.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOKEN_MINTS = void 0;
exports.resolveMint = resolveMint;
exports.getDecimals = getDecimals;
exports.toRawAmount = toRawAmount;
exports.getSwapQuote = getSwapQuote;
exports.buildSwapTransaction = buildSwapTransaction;
const axios_1 = __importDefault(require("axios"));
const web3_js_1 = require("@solana/web3.js");
const JUPITER_QUOTE_URL = 'https://quote-api.jup.ag/v6/quote';
const JUPITER_SWAP_URL = 'https://quote-api.jup.ag/v6/swap';
// Common token mint addresses on devnet / mainnet
exports.TOKEN_MINTS = {
    SOL: 'So11111111111111111111111111111111111111112', // native SOL (wrapped)
    USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    wSOL: 'So11111111111111111111111111111111111111112',
};
const TOKEN_DECIMALS = {
    SOL: 9,
    USDC: 6,
    BONK: 5,
    wSOL: 9,
};
/**
 * Resolves a token ticker (e.g., "USDC") or raw mint address to a mint address.
 */
function resolveMint(tokenTickerOrMint) {
    return exports.TOKEN_MINTS[tokenTickerOrMint] || tokenTickerOrMint;
}
/**
 * Returns the decimal precision for a token.
 */
function getDecimals(tokenTickerOrMint) {
    return TOKEN_DECIMALS[tokenTickerOrMint] ?? 6;
}
/**
 * Converts a human-readable amount (e.g., 10.5 USDC) to the integer lamport
 * equivalent based on token decimals.
 */
function toRawAmount(amount, tokenTickerOrMint) {
    const decimals = getDecimals(tokenTickerOrMint);
    return Math.floor(amount * Math.pow(10, decimals));
}
/**
 * Fetches a swap quote from Jupiter v6.
 */
async function getSwapQuote(inputToken, outputToken, amount, slippageBps = 50) {
    const inputMint = resolveMint(inputToken);
    const outputMint = resolveMint(outputToken);
    const rawInputAmount = toRawAmount(amount, inputToken);
    const response = await axios_1.default.get(JUPITER_QUOTE_URL, {
        params: {
            inputMint,
            outputMint,
            amount: rawInputAmount,
            slippageBps,
        },
    });
    const data = response.data;
    const outputDecimals = getDecimals(outputToken);
    const outputAmount = parseInt(data.outAmount) / Math.pow(10, outputDecimals);
    return {
        inputMint,
        outputMint,
        inputAmount: amount,
        outputAmount,
        priceImpactPct: data.priceImpactPct,
        routePlan: data.routePlan,
        rawQuote: data,
    };
}
/**
 * Builds a Jupiter swap VersionedTransaction using a pre-fetched quote.
 * The feePayer is set to the Kora sponsor address (gas abstraction).
 */
async function buildSwapTransaction(quote, userPublicKey, feePayerPublicKey) {
    const response = await axios_1.default.post(JUPITER_SWAP_URL, {
        quoteResponse: quote.rawQuote,
        userPublicKey: userPublicKey.toBase58(),
        // Kora fee payer override — agent does not pay gas
        feeAccount: feePayerPublicKey.toBase58(),
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto',
    });
    const swapTransactionBuf = Buffer.from(response.data.swapTransaction, 'base64');
    return web3_js_1.VersionedTransaction.deserialize(swapTransactionBuf);
}
//# sourceMappingURL=JupiterService.js.map