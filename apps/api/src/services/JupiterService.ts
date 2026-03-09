/**
 * JupiterService.ts
 * Integrates with the Jupiter v6 Swap API to build swap transactions for agents.
 * Jupiter is the leading DEX aggregator on Solana.
 */

import axios from 'axios';
import { VersionedTransaction, PublicKey } from '@solana/web3.js';

const JUPITER_QUOTE_URL = 'https://quote-api.jup.ag/v6/quote';
const JUPITER_SWAP_URL = 'https://quote-api.jup.ag/v6/swap';

// Common token mint addresses on devnet / mainnet
export const TOKEN_MINTS: Record<string, string> = {
    SOL: 'So11111111111111111111111111111111111111112',   // native SOL (wrapped)
    USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    wSOL: 'So11111111111111111111111111111111111111112',
};

const TOKEN_DECIMALS: Record<string, number> = {
    SOL: 9,
    USDC: 6,
    BONK: 5,
    wSOL: 9,
};

export interface SwapQuote {
    inputMint: string;
    outputMint: string;
    inputAmount: number;
    outputAmount: number;
    priceImpactPct: string;
    routePlan: unknown[];
    rawQuote: unknown;
}

export interface SwapTransactionResult {
    transaction: VersionedTransaction;
    quote: SwapQuote;
}

/**
 * Resolves a token ticker (e.g., "USDC") or raw mint address to a mint address.
 */
export function resolveMint(tokenTickerOrMint: string): string {
    return TOKEN_MINTS[tokenTickerOrMint] || tokenTickerOrMint;
}

/**
 * Returns the decimal precision for a token.
 */
export function getDecimals(tokenTickerOrMint: string): number {
    return TOKEN_DECIMALS[tokenTickerOrMint] ?? 6;
}

/**
 * Converts a human-readable amount (e.g., 10.5 USDC) to the integer lamport
 * equivalent based on token decimals.
 */
export function toRawAmount(amount: number, tokenTickerOrMint: string): number {
    const decimals = getDecimals(tokenTickerOrMint);
    return Math.floor(amount * Math.pow(10, decimals));
}

/**
 * Fetches a swap quote from Jupiter v6.
 */
export async function getSwapQuote(
    inputToken: string,
    outputToken: string,
    amount: number,
    slippageBps: number = 50
): Promise<SwapQuote> {
    const inputMint = resolveMint(inputToken);
    const outputMint = resolveMint(outputToken);
    const rawInputAmount = toRawAmount(amount, inputToken);

    const response = await axios.get(JUPITER_QUOTE_URL, {
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
export async function buildSwapTransaction(
    quote: SwapQuote,
    userPublicKey: PublicKey,
    feePayerPublicKey: PublicKey
): Promise<VersionedTransaction> {
    const response = await axios.post(JUPITER_SWAP_URL, {
        quoteResponse: quote.rawQuote,
        userPublicKey: userPublicKey.toBase58(),
        // Kora fee payer override — agent does not pay gas
        feeAccount: feePayerPublicKey.toBase58(),
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto',
    });

    const swapTransactionBuf = Buffer.from(response.data.swapTransaction, 'base64');
    return VersionedTransaction.deserialize(swapTransactionBuf);
}
