#!/usr/bin/env node
/**
 * x-wallet: The AI Agent's CLI Interface to Asgard
 * 
 * This binary is designed specifically for programmatic use by AI agents.
 * It expects a local Asgard daemon to be running.
 * All outputs are strictly JSON formatted for easy parsing.
 */

import axios, { AxiosInstance } from 'axios';
import fs from 'fs';
import os from 'os';
import path from 'path';
import dotenv from 'dotenv';
import { program } from 'commander';

// ─── Environment Loading ──────────────────────────────────────────

const asgardEnvPath = path.join(os.homedir(), '.asgard', '.env');
if (fs.existsSync(asgardEnvPath)) {
    dotenv.config({ path: asgardEnvPath });
} else {
    dotenv.config();
}

const ASGARD_URL = process.env.ASGARD_URL || 'http://localhost:8017';
const NODE_KEY = process.env.ASGARD_NODE_KEY || '';

const http: AxiosInstance = axios.create({
    baseURL: ASGARD_URL,
    timeout: 30000,
});

function nodeHeaders() {
    return { Authorization: `Bearer ${NODE_KEY}` };
}

function agentHeaders(apiKey: string) {
    if (!apiKey) {
        console.error(JSON.stringify({ status: 'error', error: 'Missing --api-key argument' }));
        process.exit(1);
    }
    return { Authorization: `Bearer ${apiKey}` };
}

// ─── Command Handlers ────────────────────────────────────────────

async function handleApiError(err: unknown) {
    let output: any;
    if (axios.isAxiosError(err)) {
        if (err.code === 'ECONNREFUSED') {
            output = {
                status: 'error',
                error: 'DaemonUnreachable',
                message: `Cannot reach Asgard Gateway at ${ASGARD_URL}. Is the daemon running?`
            };
        } else {
            output = err.response?.data || { status: 'error', message: err.message };
        }
    } else {
        output = { status: 'error', message: String(err) };
    }
    console.error(JSON.stringify(output, null, 2));
    process.exit(1);
}

program
    .name('x-wallet')
    .description('CLI tool for AI Agents to interact with the local Asgard wallet daemon')
    .version('1.0.0');

// Provision ────────────────────────────────────────────────────────

program.command('provision')
    .description('Provision a new wallet for an agent')
    .requiredOption('-n, --name <name>', 'Name of the agent')
    .option('-p, --policy <policy>', 'Policy profile (e.g., default)', 'default')
    .action(async (opts) => {
        try {
            const { data } = await http.post('/v1/agents', {
                name: opts.name,
                policyProfile: opts.policy
            }, { headers: nodeHeaders() });
            console.log(JSON.stringify(data, null, 2));
        } catch (err) {
            handleApiError(err);
        }
    });

// Balance ──────────────────────────────────────────────────────────

program.command('balance')
    .description('Check balances for an agent wallet')
    .requiredOption('--agent-id <id>', 'Agent ID')
    .requiredOption('--api-key <key>', 'Agent API Key')
    .action(async (opts) => {
        try {
            const { data } = await http.get(`/v1/wallet/${opts.agentId}/balance`, {
                headers: agentHeaders(opts.apiKey)
            });
            console.log(JSON.stringify(data, null, 2));
        } catch (err) {
            handleApiError(err);
        }
    });

// Transfer ─────────────────────────────────────────────────────────

program.command('transfer')
    .description('Transfer SPL tokens or SOL')
    .requiredOption('--agent-id <id>', 'Agent ID')
    .requiredOption('--api-key <key>', 'Agent API Key')
    .requiredOption('-t, --token <symbol>', 'Token symbol (e.g., SOL, USDC)')
    .requiredOption('-a, --amount <number>', 'Amount to send')
    .requiredOption('-d, --destination <address>', 'Destination Solana address')
    .action(async (opts) => {
        try {
            const { data } = await http.post('/v1/intent/transfer', {
                token: opts.token,
                amount: parseFloat(opts.amount),
                destination: opts.destination
            }, { headers: agentHeaders(opts.apiKey) });
            console.log(JSON.stringify(data, null, 2));
        } catch (err) {
            handleApiError(err);
        }
    });

// Swap ─────────────────────────────────────────────────────────────

program.command('swap')
    .description('Swap tokens via Jupiter')
    .requiredOption('--agent-id <id>', 'Agent ID')
    .requiredOption('--api-key <key>', 'Agent API Key')
    .requiredOption('--in <token>', 'Input token symbol (e.g., USDC)')
    .requiredOption('--out <token>', 'Output token symbol (e.g., SOL)')
    .requiredOption('-a, --amount <number>', 'Amount to swap')
    .option('-s, --slippage <bps>', 'Slippage in bps', '50')
    .action(async (opts) => {
        try {
            const { data } = await http.post('/v1/intent/swap', {
                inputToken: opts.in,
                outputToken: opts.out,
                amount: parseFloat(opts.amount),
                slippageBps: parseInt(opts.slippage, 10)
            }, { headers: agentHeaders(opts.apiKey) });
            console.log(JSON.stringify(data, null, 2));
        } catch (err) {
            handleApiError(err);
        }
    });

// History ──────────────────────────────────────────────────────────

program.command('history')
    .description('Retrieve transaction history')
    .requiredOption('--agent-id <id>', 'Agent ID')
    .requiredOption('--api-key <key>', 'Agent API Key')
    .option('-l, --limit <number>', 'Number of txs to fetch', '10')
    .action(async (opts) => {
        try {
            const { data } = await http.get(`/v1/wallet/${opts.agentId}/history?limit=${opts.limit}`, {
                headers: agentHeaders(opts.apiKey)
            });
            console.log(JSON.stringify(data, null, 2));
        } catch (err) {
            handleApiError(err);
        }
    });

program.parse(process.argv);
