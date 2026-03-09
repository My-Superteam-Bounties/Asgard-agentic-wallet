/**
 * JupiterService.ts
 * Integrates with the Jupiter v6 Swap API to build swap transactions for agents.
 * Jupiter is the leading DEX aggregator on Solana.
 */
import { VersionedTransaction, PublicKey } from '@solana/web3.js';
export declare const TOKEN_MINTS: Record<string, string>;
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
export declare function resolveMint(tokenTickerOrMint: string): string;
/**
 * Returns the decimal precision for a token.
 */
export declare function getDecimals(tokenTickerOrMint: string): number;
/**
 * Converts a human-readable amount (e.g., 10.5 USDC) to the integer lamport
 * equivalent based on token decimals.
 */
export declare function toRawAmount(amount: number, tokenTickerOrMint: string): number;
/**
 * Fetches a swap quote from Jupiter v6.
 */
export declare function getSwapQuote(inputToken: string, outputToken: string, amount: number, slippageBps?: number): Promise<SwapQuote>;
/**
 * Builds a Jupiter swap VersionedTransaction using a pre-fetched quote.
 * The feePayer is set to the Kora sponsor address (gas abstraction).
 */
export declare function buildSwapTransaction(quote: SwapQuote, userPublicKey: PublicKey, feePayerPublicKey: PublicKey): Promise<VersionedTransaction>;
