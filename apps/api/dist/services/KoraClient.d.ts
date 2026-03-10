/**
 * Client for interacting with the external Kora Paymaster JSON-RPC server.
 * This completely isolates private keys from the API process.
 */
export declare class KoraClient {
    private readonly rpcUrl;
    private readonly hmacSecret;
    constructor();
    private createHmacHeader;
    private call;
    /**
     * Gets the public key of the Kora Sponsor node to use as the feePayer.
     */
    getPayerSigner(): Promise<string>;
    /**
     * Sends the agent-signed transaction to Kora for validation, co-signing, and network broadcasting.
     * @param transactionBase64 The base64 serialized transaction String.
     * @returns The Solana network signature string.
     */
    signAndSendTransaction(transactionBase64: string): Promise<string>;
}
export declare const koraClient: KoraClient;
