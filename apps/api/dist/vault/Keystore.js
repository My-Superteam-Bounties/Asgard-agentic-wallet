"use strict";
/**
 * Keystore.ts
 * Handles AES-256-GCM encryption and decryption of Solana Keypair private keys.
 * The plaintext secret key bytes are NEVER written to disk.
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
exports.encryptPrivateKey = encryptPrivateKey;
exports.decryptPrivateKey = decryptPrivateKey;
exports.saveKeystoreEntry = saveKeystoreEntry;
exports.loadKeystoreEntry = loadKeystoreEntry;
exports.listAgentIds = listAgentIds;
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV for GCM
const TAG_LENGTH = 16; // 128-bit auth tag
/**
 * Derives a 32-byte AES key from the master password using PBKDF2.
 */
function deriveMasterKey(masterPassword, salt) {
    return crypto.pbkdf2Sync(masterPassword, salt, 210000, 32, 'sha256');
}
/**
 * Encrypts a Solana private key (Uint8Array 64 bytes) using AES-256-GCM.
 * Returns a single hex string: salt(32) + iv(12) + ciphertext(64) + authTag(16)
 */
function encryptPrivateKey(privateKeyBytes, masterPassword) {
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
function decryptPrivateKey(encryptedHex, masterPassword) {
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
function saveKeystoreEntry(entry, keystorePath) {
    if (!fs.existsSync(keystorePath)) {
        fs.mkdirSync(keystorePath, { recursive: true });
    }
    const filePath = path.join(keystorePath, `${entry.agentId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(entry, null, 2), { mode: 0o600 });
}
/**
 * Loads a keystore entry from disk by Agent ID.
 */
function loadKeystoreEntry(agentId, keystorePath) {
    const filePath = path.join(keystorePath, `${agentId}.json`);
    if (!fs.existsSync(filePath))
        return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}
/**
 * Lists all agent IDs present in the keystore directory.
 */
function listAgentIds(keystorePath) {
    if (!fs.existsSync(keystorePath))
        return [];
    return fs
        .readdirSync(keystorePath)
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.replace('.json', ''));
}
//# sourceMappingURL=Keystore.js.map