"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.koraClient = exports.KoraClient = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
/**
 * Client for interacting with the external Kora Paymaster JSON-RPC server.
 * This completely isolates private keys from the API process.
 */
class KoraClient {
    constructor() {
        this.rpcUrl = process.env.KORA_RPC_URL || 'http://localhost:8080';
        this.hmacSecret = process.env.KORA_HMAC_SECRET || 'kora_hmac_your-minimum-32-character-secret-here';
    }
    createHmacHeader(body, timestamp) {
        const payload = `${timestamp}:${body}`;
        return crypto_1.default.createHmac('sha256', this.hmacSecret).update(payload).digest('hex');
    }
    async call(method, params) {
        const requestBody = {
            jsonrpc: '2.0',
            id: Date.now(),
            method,
            params,
        };
        const bodyStr = JSON.stringify(requestBody);
        const timestamp = Math.floor(Date.now() / 1000);
        try {
            const response = await axios_1.default.post(this.rpcUrl, bodyStr, {
                headers: {
                    'Content-Type': 'application/json',
                    'x-kora-timestamp': timestamp.toString(),
                    'x-kora-signature': this.createHmacHeader(bodyStr, timestamp)
                }
            });
            if (response.data.error) {
                throw new Error(`Kora RPC Error [${response.data.error.code}]: ${response.data.error.message}`);
            }
            return response.data.result;
        }
        catch (error) {
            console.error('[KoraClient] Failed to reach Kora JSON-RPC:', error.message);
            throw new Error(`Gas abstraction failed: ${error.message}`);
        }
    }
    /**
     * Gets the public key of the Kora Sponsor node to use as the feePayer.
     */
    async getPayerSigner() {
        return this.call('getPayerSigner');
    }
    /**
     * Sends the agent-signed transaction to Kora for validation, co-signing, and network broadcasting.
     * @param transactionBase64 The base64 serialized transaction String.
     * @returns The Solana network signature string.
     */
    async signAndSendTransaction(transactionBase64) {
        return this.call('signAndSendTransaction', [transactionBase64]);
    }
}
exports.KoraClient = KoraClient;
exports.koraClient = new KoraClient();
//# sourceMappingURL=KoraClient.js.map