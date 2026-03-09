/**
 * Keystore.ts
 * Handles AES-256-GCM encryption and decryption of Solana Keypair private keys.
 * The plaintext secret key bytes are NEVER written to disk.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;   // 96-bit IV for GCM
const TAG_LENGTH = 16;  // 128-bit auth tag

export interface EncryptedKeystoreEntry {
    agentId: string;
    publicKey: string;
    encryptedPrivateKey: string; // hex: iv + ciphertext + authTag
    createdAt: string;
    name: string;
}

/**
 * Derives a 32-byte AES key from the master password using PBKDF2.
 */
function deriveMasterKey(masterPassword: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(masterPassword, salt, 210_000, 32, 'sha256');
}

/**
 * Encrypts a Solana private key (Uint8Array 64 bytes) using AES-256-GCM.
 * Returns a single hex string: salt(32) + iv(12) + ciphertext(64) + authTag(16)
 */
export function encryptPrivateKey(
    privateKeyBytes: Uint8Array,
    masterPassword: string
): string {
    const salt = crypto.randomBytes(32);
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = deriveMasterKey(masterPassword, salt);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([
        cipher.update(Buffer.from(privateKeyBytes)),
        cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    // Zero out the key material from working memory
    key.fill(0);

    return Buffer.concat([salt, iv, ciphertext, authTag]).toString('hex');
}

/**
 * Decrypts an AES-256-GCM encrypted private key blob back to raw bytes.
 */
export function decryptPrivateKey(
    encryptedHex: string,
    masterPassword: string
): Buffer {
    const data = Buffer.from(encryptedHex, 'hex');

    const salt = data.subarray(0, 32);
    const iv = data.subarray(32, 32 + IV_LENGTH);
    const authTag = data.subarray(data.length - TAG_LENGTH);
    const ciphertext = data.subarray(32 + IV_LENGTH, data.length - TAG_LENGTH);

    const key = deriveMasterKey(masterPassword, salt);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    // Zero out the key material from working memory
    key.fill(0);

    return decrypted;
}

/**
 * Persists a keystored entry to disk as an encrypted JSON file.
 * Location: {KEYSTORE_PATH}/{agentId}.json
 */
export function saveKeystoreEntry(
    entry: EncryptedKeystoreEntry,
    keystorePath: string
): void {
    if (!fs.existsSync(keystorePath)) {
        fs.mkdirSync(keystorePath, { recursive: true });
    }
    const filePath = path.join(keystorePath, `${entry.agentId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(entry, null, 2), { mode: 0o600 });
}

/**
 * Loads a keystore entry from disk by Agent ID.
 */
export function loadKeystoreEntry(
    agentId: string,
    keystorePath: string
): EncryptedKeystoreEntry | null {
    const filePath = path.join(keystorePath, `${agentId}.json`);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as EncryptedKeystoreEntry;
}

/**
 * Lists all agent IDs present in the keystore directory.
 */
export function listAgentIds(keystorePath: string): string[] {
    if (!fs.existsSync(keystorePath)) return [];
    return fs
        .readdirSync(keystorePath)
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.replace('.json', ''));
}
