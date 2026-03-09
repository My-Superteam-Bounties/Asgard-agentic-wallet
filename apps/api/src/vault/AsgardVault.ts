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

import {
    Keypair,
    PublicKey,
    Connection,
    VersionedTransaction,
    TransactionMessage,
    TransactionInstruction,
    AddressLookupTableAccount,
} from '@solana/web3.js';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import {
    encryptPrivateKey,
    decryptPrivateKey,
    saveKeystoreEntry,
    loadKeystoreEntry,
    EncryptedKeystoreEntry,
} from './Keystore';

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

export class AsgardVault {
    private masterPassword: string;
    private keystorePath: string;
    private connection: Connection;

    constructor(masterPassword: string, keystorePath: string, rpcUrl: string) {
        if (!masterPassword || masterPassword.length < 16) {
            throw new Error('ASGARD_MASTER_PASSWORD must be at least 16 characters');
        }
        this.masterPassword = masterPassword;
        this.keystorePath = keystorePath;
        this.connection = new Connection(rpcUrl, 'confirmed');
    }

    /**
     * Generates a new Solana Keypair for an agent, encrypts the private key
     * immediately using AES-256-GCM, and persists the encrypted blob.
     * Returns public data only — the raw private key is never returned.
     */
    async provisionAgent(name: string): Promise<AgentWallet> {
        const keypair = Keypair.generate();
        const agentId = uuidv4();
        const apiKey = `asgard_sk_${crypto.randomBytes(24).toString('hex')}`;

        const encryptedPrivateKey = encryptPrivateKey(
            keypair.secretKey,
            this.masterPassword
        );

        // Immediately zero the raw keypair from this scope
        keypair.secretKey.fill(0);

        const entry: EncryptedKeystoreEntry = {
            agentId,
            publicKey: keypair.publicKey.toBase58(),
            encryptedPrivateKey,
            createdAt: new Date().toISOString(),
            name,
        };

        saveKeystoreEntry(entry, this.keystorePath);

        return {
            agentId,
            publicKey: keypair.publicKey.toBase58(),
            apiKey,
            name,
            createdAt: entry.createdAt,
        };
    }

    /**
     * Loads an agent's public key without decrypting the private key.
     * Safe for balance lookups, address resolution, etc.
     */
    getAgentPublicKey(agentId: string): PublicKey {
        const entry = loadKeystoreEntry(agentId, this.keystorePath);
        if (!entry) throw new Error(`Agent not found: ${agentId}`);
        return new PublicKey(entry.publicKey);
    }

    /**
     * Signs a pre-built VersionedTransaction using the agent's stored secret key.
     * The decrypted private key is held in memory for the minimum possible time,
     * then zeroed immediately after signing.
     */
    async signTransaction(
        agentId: string,
        transaction: VersionedTransaction
    ): Promise<VersionedTransaction> {
        const entry = loadKeystoreEntry(agentId, this.keystorePath);
        if (!entry) throw new Error(`Agent not found: ${agentId}`);

        // Transiently decrypt the private key
        const privateKeyBytes = decryptPrivateKey(
            entry.encryptedPrivateKey,
            this.masterPassword
        );

        const signer = Keypair.fromSecretKey(privateKeyBytes);

        try {
            transaction.sign([signer]);
        } finally {
            // Zero key material from memory immediately — always, even on error
            signer.secretKey.fill(0);
            privateKeyBytes.fill(0);
        }

        return transaction;
    }

    /**
     * Builds a VersionedTransaction from a set of instructions.
     * Fetches the latest blockhash from the network.
     */
    async buildTransaction(
        feePayer: PublicKey,
        instructions: TransactionInstruction[],
        lookupTables: AddressLookupTableAccount[] = []
    ): Promise<VersionedTransaction> {
        const { blockhash } = await this.connection.getLatestBlockhash('confirmed');

        const message = new TransactionMessage({
            payerKey: feePayer,
            recentBlockhash: blockhash,
            instructions,
        }).compileToV0Message(lookupTables);

        return new VersionedTransaction(message);
    }

    /**
     * Gets the Solana Connection instance for direct RPC queries.
     */
    getConnection(): Connection {
        return this.connection;
    }
}
