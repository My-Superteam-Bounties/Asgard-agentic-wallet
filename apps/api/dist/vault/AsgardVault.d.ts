/**
 * AsgardVault.ts
 * The secure core of Asgard. The ONLY component that touches private keys.
 *
 * Responsibilities:
 *  - Generate new Solana Keypairs for agents
 *  - Encrypt them immediately via Keystore (AES-256-GCM)
 *  - Load and decrypt keys transiently for signing ONLY
 *  - Build and sign Solana VersionedTransactions
 *  - Zero key material from memory immediately after signing
 */
import { PublicKey, Connection, VersionedTransaction, TransactionInstruction, AddressLookupTableAccount } from '@solana/web3.js';
export interface AgentWallet {
    agentId: string;
    publicKey: string;
    apiKey: string;
    name: string;
    createdAt: string;
}
export interface SignedTransactionResult {
    signature: string;
    transactionBase64: string;
}
export declare class AsgardVault {
    private masterPassword;
    private keystorePath;
    private connection;
    constructor(masterPassword: string, keystorePath: string, rpcUrl: string);
    /**
     * Generates a new Solana Keypair for an agent, encrypts the private key
     * immediately using AES-256-GCM, and persists the encrypted blob.
     * Returns public data only — the raw private key is never returned.
     */
    provisionAgent(name: string): Promise<AgentWallet>;
    /**
     * Loads an agent's public key without decrypting the private key.
     * Safe for balance lookups, address resolution, etc.
     */
    getAgentPublicKey(agentId: string): PublicKey;
    /**
     * Signs a pre-built VersionedTransaction using the agent's stored secret key.
     * The decrypted private key is held in memory for the minimum possible time,
     * then zeroed immediately after signing.
     */
    signTransaction(agentId: string, transaction: VersionedTransaction): Promise<VersionedTransaction>;
    /**
     * Builds a VersionedTransaction from a set of instructions.
     * Fetches the latest blockhash from the network.
     */
    buildTransaction(feePayer: PublicKey, instructions: TransactionInstruction[], lookupTables?: AddressLookupTableAccount[]): Promise<VersionedTransaction>;
    /**
     * Gets the Solana Connection instance for direct RPC queries.
     */
    getConnection(): Connection;
}
