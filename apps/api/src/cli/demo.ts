/**
 * demo.ts
 * Asgard AI Agent Simulation (CLI Demo)
 *
 * Simulates an autonomous AI agent that:
 *  1. Provisions itself a new Asgard wallet (admin call)
 *  2. Receives a devnet airdrop of SOL
 *  3. Checks its wallet balance
 *  4. "Decides" to act based on a mock market signal
 *  5. Executes a Jupiter swap via the Asgard API — without holding a private key
 *
 * Usage:
 *   npm run demo
 *   (Asgard server must be running on localhost:3000)
 */

import axios from 'axios';

const ASGARD_BASE_URL = process.env.ASGARD_URL || 'http://localhost:3000/v1';
const ADMIN_KEY = process.env.ASGARD_ADMIN_KEY || 'CHANGE_ME';

const COLORS = {
    reset: '\x1b[0m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
};

function log(icon: string, label: string, msg: string, color = COLORS.cyan) {
    console.log(`${color}${icon}  ${COLORS.bold}[${label}]${COLORS.reset} ${msg}`);
}

function step(n: number, label: string) {
    console.log(`\n${COLORS.bold}${COLORS.yellow}${'─'.repeat(60)}${COLORS.reset}`);
    console.log(`${COLORS.bold}${COLORS.yellow}  Step ${n}: ${label}${COLORS.reset}`);
    console.log(`${COLORS.bold}${COLORS.yellow}${'─'.repeat(60)}${COLORS.reset}`);
}

async function delay(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

async function main() {
    console.log(`\n${COLORS.bold}${COLORS.cyan}`);
    console.log('  ╔══════════════════════════════════════════════════╗');
    console.log('  ║      🛡️  Asgard — AI Agent Wallet Simulation      ║');
    console.log('  ║         Autonomous Solana Trading Demo            ║');
    console.log('  ╚══════════════════════════════════════════════════╝');
    console.log(COLORS.reset);

    // ── Step 1: Provision a new agent wallet ─────────────────────────────────

    step(1, 'Provisioning Agent Wallet via Asgard Admin API');
    log('🔐', 'ADMIN', 'Creating new agent: TradingBot-DEMO with "default" policy...');

    const agentResponse = await axios.post(
        `${ASGARD_BASE_URL}/agents`,
        { name: 'TradingBot-DEMO', policyProfile: 'default' },
        { headers: { Authorization: `Bearer ${ADMIN_KEY}` } }
    );

    const { agentId, walletAddress, apiKey, policyProfile } = agentResponse.data;

    log('✅', 'AGENT', `Agent ID:       ${COLORS.dim}${agentId}${COLORS.reset}`);
    log('✅', 'AGENT', `Wallet Address: ${COLORS.dim}${walletAddress}${COLORS.reset}`);
    log('✅', 'AGENT', `Policy Profile: ${policyProfile}`);
    log('⚠️', 'AGENT', `API Key stored: ${apiKey.slice(0, 20)}...  (shown once)`, COLORS.yellow);

    // ── Step 2: Check balance ─────────────────────────────────────────────────

    step(2, 'Agent Checks Its Own Wallet Balance');
    log('🧠', 'AGENT BRAIN', 'Querying Asgard for current balances...');

    const balanceResponse = await axios.get(
        `${ASGARD_BASE_URL}/wallet/${agentId}/balance`,
        { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    const { balances } = balanceResponse.data;
    log('💰', 'BALANCE', `SOL:  ${balances.SOL}`);
    log('💰', 'BALANCE', `USDC: ${balances.USDC}`);

    // ── Step 3: Simulate AI decision-making ──────────────────────────────────

    step(3, 'AI Decision Engine — Evaluating Market Signal');
    log('🧠', 'AGENT BRAIN', 'Analyzing mock market conditions...');
    await delay(1000);
    log('📊', 'MARKET SIGNAL', 'SOL price is below 14-day moving average.', COLORS.green);
    log('📊', 'MARKET SIGNAL', 'RSI indicates oversold conditions.', COLORS.green);
    log('🤖', 'DECISION', 'Buying SOL with available USDC.', COLORS.green);

    // ── Step 4: Submit swap intent to Asgard ─────────────────────────────────

    step(4, 'Submitting Swap Intent to Asgard Gateway');
    log('📤', 'INTENT', 'POST /v1/intent/swap — { USDC → SOL, 10 USDC }');
    log('🔍', 'POLICY', 'Asgard evaluating intent against agent policy...');
    await delay(500);

    try {
        const swapResponse = await axios.post(
            `${ASGARD_BASE_URL}/intent/swap`,
            {
                inputToken: 'USDC',
                outputToken: 'SOL',
                amount: 10,
                slippageBps: 50,
            },
            { headers: { Authorization: `Bearer ${apiKey}` } }
        );

        const { signature, outputAmount, explorerUrl } = swapResponse.data;

        // ── Step 5: Display result ────────────────────────────────────────────────

        step(5, 'Transaction Confirmed on Solana Devnet ✅');
        log('✅', 'SUCCESS', `Swap completed successfully!`, COLORS.green);
        log('🔁', 'RESULT', `10 USDC → ${outputAmount} SOL`);
        log('📝', 'SIGNATURE', `${COLORS.dim}${signature}${COLORS.reset}`);
        log('🔗', 'EXPLORER', `${COLORS.cyan}${explorerUrl}${COLORS.reset}`);

        console.log(`\n${COLORS.bold}${COLORS.green}`);
        console.log('  ╔══════════════════════════════════════════════════╗');
        console.log('  ║  Demo complete. The AI agent held no private key.║');
        console.log('  ║  All operations enforced by Asgard Policy Engine.║');
        console.log('  ╚══════════════════════════════════════════════════╝');
        console.log(COLORS.reset);
    } catch (err: unknown) {
        if (axios.isAxiosError(err)) {
            const data = err.response?.data;
            log('🚫', 'POLICY VIOLATION', `Code: ${data?.code}`, COLORS.red);
            log('🚫', 'POLICY VIOLATION', `Reason: ${data?.message}`, COLORS.red);

            console.log(`\n${COLORS.yellow}ℹ️  This is expected behavior when testing with low balance.`);
            console.log(`   Fund the agent's wallet with USDC on devnet and retry.${COLORS.reset}\n`);
        } else {
            throw err;
        }
    }
}

main().catch((err) => {
    console.error(`\n${COLORS.red}Fatal error:${COLORS.reset}`, err.message);
    process.exit(1);
});
