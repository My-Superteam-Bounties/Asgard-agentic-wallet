"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AsgardVault = void 0;
const web3_js_1 = require("@solana/web3.js");
const uuid_1 = require("uuid");
const crypto = __importStar(require("crypto"));
const Keystore_1 = require("./Keystore");
class AsgardVault {
    constructor(masterPassword, keystorePath, rpcUrl) {
        if (!masterPassword || masterPassword.length < 16) {
            throw new Error('ASGARD_MASTER_PASSWORD must be at least 16 characters');
        }
        this.masterPassword = masterPassword;
        this.keystorePath = keystorePath;
        this.connection = new web3_js_1.Connection(rpcUrl, 'confirmed');
    }
    /**
     * Generates a new Solana Keypair for an agent, encrypts the private key
     * immediately using AES-256-GCM, and persists the encrypted blob.
     * Returns public data only — the raw private key is never returned.
     */
    async provisionAgent(name) {
        const keypair = web3_js_1.Keypair.generate();
        const agentId = (0, uuid_1.v4)();
        const apiKey = `asgard_sk_${crypto.randomBytes(24).toString('hex')}`;
        const encryptedPrivateKey = (0, Keystore_1.encryptPrivateKey)(keypair.secretKey, this.masterPassword);
        // Immediately zero the raw keypair from this scope
        keypair.secretKey.fill(0);
        const entry = {
            agentId,
            publicKey: keypair.publicKey.toBase58(),
            encryptedPrivateKey,
            createdAt: new Date().toISOString(),
            name,
        };
        (0, Keystore_1.saveKeystoreEntry)(entry, this.keystorePath);
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
    getAgentPublicKey(agentId) {
        const entry = (0, Keystore_1.loadKeystoreEntry)(agentId, this.keystorePath);
        if (!entry)
            throw new Error(`Agent not found: ${agentId}`);
        return new web3_js_1.PublicKey(entry.publicKey);
    }
    /**
     * Signs a pre-built VersionedTransaction using the agent's stored secret key.
     * The decrypted private key is held in memory for the minimum possible time,
     * then zeroed immediately after signing.
     */
    async signTransaction(agentId, transaction) {
        const entry = (0, Keystore_1.loadKeystoreEntry)(agentId, this.keystorePath);
        if (!entry)
            throw new Error(`Agent not found: ${agentId}`);
        // Transiently decrypt the private key
        const privateKeyBytes = (0, Keystore_1.decryptPrivateKey)(entry.encryptedPrivateKey, this.masterPassword);
        const signer = web3_js_1.Keypair.fromSecretKey(privateKeyBytes);
        try {
            transaction.sign([signer]);
        }
        finally {
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
    async buildTransaction(feePayer, instructions, lookupTables = []) {
        const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
        const message = new web3_js_1.TransactionMessage({
            payerKey: feePayer,
            recentBlockhash: blockhash,
            instructions,
        }).compileToV0Message(lookupTables);
        return new web3_js_1.VersionedTransaction(message);
    }
    /**
     * Gets the Solana Connection instance for direct RPC queries.
     */
    getConnection() {
        return this.connection;
    }
}
exports.AsgardVault = AsgardVault;
//# sourceMappingURL=AsgardVault.js.map