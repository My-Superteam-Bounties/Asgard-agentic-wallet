/**
 * Keystore.ts
 * Handles AES-256-GCM encryption and decryption of Solana Keypair private keys.
 * The plaintext secret key bytes are NEVER written to disk.
 */
export interface EncryptedKeystoreEntry {
    agentId: string;
    publicKey: string;
    encryptedPrivateKey: string;
    createdAt: string;
    name: string;
}
/**
 * Encrypts a Solana private key (Uint8Array 64 bytes) using AES-256-GCM.
 * Returns a single hex string: salt(32) + iv(12) + ciphertext(64) + authTag(16)
 */
export declare function encryptPrivateKey(privateKeyBytes: Uint8Array, masterPassword: string): string;
/**
 * Decrypts an AES-256-GCM encrypted private key blob back to raw bytes.
 */
export declare function decryptPrivateKey(encryptedHex: string, masterPassword: string): Buffer;
/**
 * Persists a keystored entry to disk as an encrypted JSON file.
 * Location: {KEYSTORE_PATH}/{agentId}.json
 */
export declare function saveKeystoreEntry(entry: EncryptedKeystoreEntry, keystorePath: string): void;
/**
 * Loads a keystore entry from disk by Agent ID.
 */
export declare function loadKeystoreEntry(agentId: string, keystorePath: string): EncryptedKeystoreEntry | null;
/**
 * Lists all agent IDs present in the keystore directory.
 */
export declare function listAgentIds(keystorePath: string): string[];
