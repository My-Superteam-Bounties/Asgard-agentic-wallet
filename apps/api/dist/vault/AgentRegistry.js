"use strict";
/**
 * AgentRegistry.ts
 * Persists agent metadata (API keys, policy profiles, public keys) separately
 * from the encrypted keystore. This is NOT sensitive — it contains no private keys.
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
exports.hashApiKey = hashApiKey;
exports.registerAgent = registerAgent;
exports.findAgentByApiKey = findAgentByApiKey;
exports.getAgentById = getAgentById;
exports.updateAgentPolicy = updateAgentPolicy;
exports.listAgents = listAgents;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const REGISTRY_FILE = path.resolve(process.cwd(), 'keystore', 'registry.json');
function loadRegistry() {
    if (!fs.existsSync(REGISTRY_FILE))
        return {};
    return JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8'));
}
function saveRegistry(registry) {
    const dir = path.dirname(REGISTRY_FILE);
    if (!fs.existsSync(dir))
        fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2), { mode: 0o600 });
}
/**
 * Hashes an API key for safe storage. We never store the plaintext key.
 */
function hashApiKey(apiKey) {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
}
/**
 * Registers a new agent in the registry.
 */
function registerAgent(agentId, name, publicKey, apiKey, policyProfile, customPolicy) {
    const registry = loadRegistry();
    registry[agentId] = {
        agentId,
        name,
        publicKey,
        apiKeyHash: hashApiKey(apiKey),
        policyProfile,
        ...(customPolicy ? { customPolicy } : {}),
        createdAt: new Date().toISOString(),
        active: true,
    };
    saveRegistry(registry);
}
/**
 * Looks up an agent by their raw API key (hashed for comparison).
 * Returns null if no agent matches.
 */
function findAgentByApiKey(apiKey) {
    const registry = loadRegistry();
    const keyHash = hashApiKey(apiKey);
    console.log("Key hash", keyHash);
    const record = Object.values(registry).find((r) => r.apiKeyHash === keyHash && r.active);
    return record || null;
}
/**
 * Looks up an agent record directly by Agent ID.
 */
function getAgentById(agentId) {
    const registry = loadRegistry();
    return registry[agentId] || null;
}
/**
 * Updates an agent's custom policy overrides.
 */
function updateAgentPolicy(agentId, customPolicy) {
    const registry = loadRegistry();
    if (!registry[agentId])
        return false;
    registry[agentId].customPolicy = {
        ...(registry[agentId].customPolicy || {}),
        ...customPolicy
    };
    saveRegistry(registry);
    return true;
}
/**
 * Lists all registered agents (for admin/monitoring endpoints).
 */
function listAgents() {
    return Object.values(loadRegistry());
}
//# sourceMappingURL=AgentRegistry.js.map