/**
 * AgentRegistry.ts
 * Persists agent metadata (API keys, policy profiles, public keys) separately
 * from the encrypted keystore. This is NOT sensitive — it contains no private keys.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface AgentRecord {
    agentId: string;
    name: string;
    publicKey: string;
    apiKeyHash: string;   // SHA-256 hash of the raw API key (never store plaintext)
    policyProfile: string;
    createdAt: string;
    active: boolean;
}

const REGISTRY_FILE = path.resolve(process.cwd(), 'keystore', 'registry.json');

function loadRegistry(): Record<string, AgentRecord> {
    if (!fs.existsSync(REGISTRY_FILE)) return {};
    return JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8')) as Record<string, AgentRecord>;
}

function saveRegistry(registry: Record<string, AgentRecord>): void {
    const dir = path.dirname(REGISTRY_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2), { mode: 0o600 });
}

/**
 * Hashes an API key for safe storage. We never store the plaintext key.
 */
export function hashApiKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Registers a new agent in the registry.
 */
export function registerAgent(
    agentId: string,
    name: string,
    publicKey: string,
    apiKey: string,
    policyProfile: string
): void {
    const registry = loadRegistry();
    registry[agentId] = {
        agentId,
        name,
        publicKey,
        apiKeyHash: hashApiKey(apiKey),
        policyProfile,
        createdAt: new Date().toISOString(),
        active: true,
    };
    saveRegistry(registry);
}

/**
 * Looks up an agent by their raw API key (hashed for comparison).
 * Returns null if no agent matches.
 */
export function findAgentByApiKey(apiKey: string): AgentRecord | null {
    const registry = loadRegistry();
    const keyHash = hashApiKey(apiKey);
    const record = Object.values(registry).find(
        (r) => r.apiKeyHash === keyHash && r.active
    );
    return record || null;
}

/**
 * Looks up an agent record directly by Agent ID.
 */
export function getAgentById(agentId: string): AgentRecord | null {
    const registry = loadRegistry();
    return registry[agentId] || null;
}

/**
 * Lists all registered agents (for admin/monitoring endpoints).
 */
export function listAgents(): AgentRecord[] {
    return Object.values(loadRegistry());
}
