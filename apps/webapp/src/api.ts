import axios from 'axios';

export const api = axios.create({ timeout: 15000 });

api.interceptors.request.use(config => {
    const stored = localStorage.getItem('asgard_url');
    const fallback = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:8017');
    config.baseURL = stored || fallback;
    return config;
});
// Attach node key for node-level auth calls
export function nodeHeaders() {
    const key = (window as any).ASGARD_NODE_KEY || localStorage.getItem('asgard_node_key') || localStorage.getItem('asgard_admin_key') || '';
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
    const { data } = await api.get('/v1/agents', { headers: nodeHeaders() });
    return data.agents;
}

export async function provisionAgent(name: string, policyProfile: string) {
    const { data } = await api.post('/v1/agents', { name, policyProfile }, { headers: nodeHeaders() });
    return data;
}

export async function fetchBalance(agentId: string, apiKey: string): Promise<{ address: string; balances: Balances }> {
    const { data } = await api.get(`/v1/wallet/${agentId}/balance`, { headers: agentHeaders(apiKey) });
    return data;
}

export async function fetchHistory(agentId: string, apiKey: string, limit: number = 10) {
    const { data } = await api.get(`/v1/wallet/${agentId}/history?limit=${limit}`, { headers: agentHeaders(apiKey) });
    return data;
}

export async function executeSwap(apiKey: string, payload: {
    inputToken: string; outputToken: string; amount: number; slippageBps: number;
}) {
    const { data } = await api.post('/v1/intent/swap', payload, { headers: agentHeaders(apiKey) });
    return data;
}

export async function executeTransfer(apiKey: string, payload: {
    token: string; amount: number; destination: string;
}) {
    const { data } = await api.post('/v1/intent/transfer', payload, { headers: agentHeaders(apiKey) });
    return data;
}
