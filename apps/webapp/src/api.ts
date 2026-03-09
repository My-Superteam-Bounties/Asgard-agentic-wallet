import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const api = axios.create({ baseURL: BASE_URL, timeout: 15000 });

// Attach admin key for admin-only calls
export function adminHeaders() {
    const key = localStorage.getItem('asgard_admin_key') || '';
    return { Authorization: `Bearer ${key}` };
}

// Attach agent api key for agent calls
export function agentHeaders(apiKey: string) {
    return { Authorization: `Bearer ${apiKey}` };
}

// Types
export interface Agent {
    agentId: string;
    name: string;
    publicKey: string;
    policyProfile: string;
    createdAt: string;
    active: boolean;
}

export interface Balances {
    SOL: number;
    USDC: number;
    BONK: number;
}

export interface GatewayHealth {
    status: string;
    service: string;
    version: string;
    network: string;
    timestamp: string;
}

// API calls
export async function fetchHealth(): Promise<GatewayHealth> {
    const { data } = await api.get('/health');
    return data;
}

export async function fetchAgents(): Promise<Agent[]> {
    const { data } = await api.get('/v1/agents', { headers: adminHeaders() });
    return data.agents;
}

export async function provisionAgent(name: string, policyProfile: string) {
    const { data } = await api.post('/v1/agents', { name, policyProfile });
    return data;
}

export async function fetchBalance(agentId: string, apiKey: string): Promise<{ address: string; balances: Balances }> {
    const { data } = await api.get(`/v1/wallet/${agentId}/balance`, { headers: agentHeaders(apiKey) });
    return data;
}

export async function executeSwap(agentId: string, apiKey: string, payload: {
    inputToken: string; outputToken: string; amount: number; slippageBps: number;
}) {
    const { data } = await api.post('/v1/intent/swap', payload, { headers: agentHeaders(apiKey) });
    return data;
}

export async function executeTransfer(agentId: string, apiKey: string, payload: {
    token: string; amount: number; destination: string;
}) {
    const { data } = await api.post('/v1/intent/transfer', payload, { headers: agentHeaders(apiKey) });
    return data;
}
