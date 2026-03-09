#!/usr/bin/env node
"use strict";
/**
 * Asgard CLI — Operator Command Center
 *
 * A feature-rich terminal interface for managing AI agent wallets.
 * Communicates with the Asgard Gateway via HTTP API — no direct imports from @asgard/api.
 *
 * Usage: npx ts-node src/index.ts
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chalk_1 = __importDefault(require("chalk"));
const inquirer_1 = __importDefault(require("inquirer"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const ora_1 = __importDefault(require("ora"));
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const crypto_1 = require("crypto");
const dotenv_1 = __importDefault(require("dotenv"));
const child_process_1 = require("child_process");
const commander_1 = require("commander");
// ─── Configuration ────────────────────────────────────────────────────────────
const asgardEnvPath = path_1.default.join(os_1.default.homedir(), '.asgard', '.env');
if (fs_1.default.existsSync(asgardEnvPath)) {
    dotenv_1.default.config({ path: asgardEnvPath });
}
else {
    dotenv_1.default.config();
}
const ASGARD_URL = process.env.ASGARD_URL || 'http://localhost:8017';
const NODE_KEY = process.env.ASGARD_NODE_KEY || '';
const http = axios_1.default.create({
    baseURL: ASGARD_URL,
    timeout: 15000,
});
// ─── ANSI Art & Branding ─────────────────────────────────────────────────────
const LOGO = `
${chalk_1.default.cyan.bold('   █████╗ ███████╗ ██████╗  █████╗ ██████╗ ██████╗ ')}
${chalk_1.default.cyan.bold(' ██╔══██╗██╔════╝██╔════╝ ██╔══██╗██╔══██╗██╔══██╗')}
${chalk_1.default.cyan.bold(' ███████║███████╗██║  ███╗███████║██████╔╝██║  ██║')}
${chalk_1.default.cyan.bold(' ██╔══██║╚════██║██║   ██║██╔══██║██╔══██╗██║  ██║')}
${chalk_1.default.cyan.bold(' ██║  ██║███████║╚██████╔╝██║  ██║██║  ██║██████╔╝')}
${chalk_1.default.cyan.bold(' ╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ')}

${chalk_1.default.dim('  Institutional-Grade Agentic Wallet for AI on Solana')}
${chalk_1.default.dim('  ─────────────────────────────────────────────────────')}
${chalk_1.default.dim(`  Gateway: ${ASGARD_URL}`)}
`;
const DIVIDER = chalk_1.default.dim('  ' + '─'.repeat(58));
// ─── Utility Helpers ─────────────────────────────────────────────────────────
function nodeHeaders() {
    return { Authorization: `Bearer ${NODE_KEY}` };
}
function agentHeaders(apiKey) {
    return { Authorization: `Bearer ${apiKey}` };
}
function explorerLink(sig) {
    return chalk_1.default.cyan.underline(`https://explorer.solana.com/tx/${sig}?cluster=devnet`);
}
function formatBalance(balances) {
    return Object.entries(balances)
        .map(([token, amount]) => `${chalk_1.default.bold(token)}: ${chalk_1.default.yellow(amount.toFixed(4))}`)
        .join('  │  ');
}
function handleApiError(err) {
    if (axios_1.default.isAxiosError(err)) {
        const data = err.response?.data;
        if (data?.code) {
            console.log(`\n  ${chalk_1.default.red('✖')} ${chalk_1.default.bold('Policy Violation:')} ${data.code}`);
            console.log(`  ${chalk_1.default.dim(data.message)}`);
            if (data.dailyRemaining !== undefined) {
                console.log(`  ${chalk_1.default.dim(`Daily remaining: $${data.dailyRemaining} USDC`)}`);
            }
        }
        else if (err.code === 'ECONNREFUSED') {
            console.log(`\n  ${chalk_1.default.red('✖')} Cannot reach Asgard Gateway at ${ASGARD_URL}`);
            console.log(`  ${chalk_1.default.dim('Make sure the API server is running: npm run api')}`);
        }
        else {
            console.log(`\n  ${chalk_1.default.red('✖')} ${data?.message || err.message}`);
        }
    }
    else {
        console.log(`\n  ${chalk_1.default.red('✖')} ${String(err)}`);
    }
    process.exit(1);
}
// ─── Commands ─────────────────────────────────────────────────────────────────
async function initNode() {
    console.log(`\n  ${chalk_1.default.bold.cyan('Initialize Local Asgard Node')}\n`);
    console.log(`  ${chalk_1.default.dim('Setup your Master Encryption Password securely.')}`);
    console.log(`  ${chalk_1.default.dim('This password never leaves your machine and encrypts all agent wallets.')}\n`);
    const asgardDir = path_1.default.join(os_1.default.homedir(), '.asgard');
    if (fs_1.default.existsSync(path_1.default.join(asgardDir, '.env'))) {
        const { overwrite } = await inquirer_1.default.prompt([
            { type: 'confirm', name: 'overwrite', message: '  ⚠  .asgard configuration already exists. Overwrite?', default: false }
        ]);
        if (!overwrite)
            return;
    }
    const answers = await inquirer_1.default.prompt([
        {
            type: 'password',
            name: 'password',
            message: '  Create Master Password:',
            mask: '*',
            validate: (v) => v.length >= 16 || 'Password must be at least 16 characters long for AES-256 encryption.',
        },
        {
            type: 'input',
            name: 'rpcUrl',
            message: '  Solana RPC URL (Devnet/Mainnet):',
            default: 'https://api.devnet.solana.com',
        }
    ]);
    const spinner = (0, ora_1.default)({ text: 'Generating secure Node Key and configuring environment...', prefixText: '  ' }).start();
    try {
        if (!fs_1.default.existsSync(asgardDir)) {
            fs_1.default.mkdirSync(asgardDir, { mode: 0o700, recursive: true });
        }
        const nodeKey = `asgard_node_${(0, crypto_1.randomBytes)(16).toString('hex')}`;
        const envContent = `ASGARD_MASTER_PASSWORD="${answers.password}"\nSOLANA_RPC_URL="${answers.rpcUrl}"\nASGARD_NODE_KEY="${nodeKey}"\nSOLANA_NETWORK="devnet"\nKEYSTORE_PATH="${path_1.default.join(asgardDir, 'keystore')}"\n`;
        fs_1.default.writeFileSync(path_1.default.join(asgardDir, '.env'), envContent, { mode: 0o600 });
        spinner.succeed(chalk_1.default.green('Local node configuration saved! (~/.asgard/.env)'));
        console.log(`\n  ${chalk_1.default.green('✔')} You're all set! Start the daemon with: ${chalk_1.default.cyan('asgard start')}\n`);
        process.exit(0);
    }
    catch (err) {
        spinner.fail(chalk_1.default.red('Failed to initialize node'));
        console.log(`  ${chalk_1.default.red(err.message)}`);
    }
}
async function checkHealth() {
    const spinner = (0, ora_1.default)({ text: 'Checking gateway status...', prefixText: '  ' }).start();
    try {
        const { data } = await http.get('/health');
        spinner.succeed(chalk_1.default.green('Gateway is online'));
        console.log();
        const table = new cli_table3_1.default({ style: { head: [], border: [] } });
        table.push([chalk_1.default.dim('Service'), data.service], [chalk_1.default.dim('Version'), data.version], [chalk_1.default.dim('Network'), chalk_1.default.yellow(data.network)], [chalk_1.default.dim('Status'), chalk_1.default.green(data.status)], [chalk_1.default.dim('Timestamp'), chalk_1.default.dim(data.timestamp)]);
        console.log(table.toString());
    }
    catch (err) {
        spinner.fail(chalk_1.default.red('Gateway unreachable'));
        handleApiError(err);
    }
}
async function startDaemon() {
    console.log(`\n  ${chalk_1.default.bold.cyan('Start Asgard Daemon')}\n`);
    // ── Pre-flight: ensure the node has been initialized ──────────────────
    const asgardDir = path_1.default.join(os_1.default.homedir(), '.asgard');
    const envFile = path_1.default.join(asgardDir, '.env');
    if (!fs_1.default.existsSync(envFile)) {
        console.log(`  ${chalk_1.default.red('✖')} Asgard has not been initialized yet.`);
        console.log(`  ${chalk_1.default.dim('Run')} ${chalk_1.default.cyan('asgard init')} ${chalk_1.default.dim('to create your master password and configure the node.')}\n`);
        return;
    }
    // Check if API is already running
    try {
        await http.get('/health', { timeout: 1500 });
        console.log(`  ${chalk_1.default.green('✔')} Daemon is already running at ${ASGARD_URL}`);
        return;
    }
    catch (e) {
        // Expected to fail if not running
    }
    const apiPath = path_1.default.resolve(__dirname, '../../api/dist/server.js');
    if (!fs_1.default.existsSync(apiPath)) {
        console.log(`  ${chalk_1.default.red('✖')} Could not find API server at: ${apiPath}`);
        console.log(`  ${chalk_1.default.dim('Make sure you have run: pnpm build')}`);
        return;
    }
    const spinner = (0, ora_1.default)({ text: 'Starting Asgard Gateway daemon...', prefixText: '  ' }).start();
    // Write daemon stdout/stderr to a log file so errors are never lost
    const logPath = path_1.default.join(asgardDir, 'daemon.log');
    const logFd = fs_1.default.openSync(logPath, 'a');
    // Force reload the env in case the user just ran init or edited the file
    // Otherwise passing process.env to fork will pass the old cached values
    require('dotenv').config({ path: envFile, override: true });
    // Spawn the API server as a detached background process
    const child = (0, child_process_1.fork)(apiPath, [], {
        detached: true,
        stdio: ['ignore', logFd, logFd, 'ipc'],
        env: { ...process.env },
    });
    child.unref();
    child.disconnect();
    // Poll for health with retries instead of a single wait
    const MAX_RETRIES = 10;
    const RETRY_DELAY = 1500; // ms
    let booted = false;
    for (let i = 0; i < MAX_RETRIES; i++) {
        await new Promise(r => setTimeout(r, RETRY_DELAY));
        try {
            await http.get('/health', { timeout: 2000 });
            booted = true;
            break;
        }
        catch (_) {
            // Keep retrying
        }
    }
    if (booted) {
        spinner.succeed(chalk_1.default.green('Daemon started successfully!'));
        console.log(`\n  ${chalk_1.default.bold('Dashboard:')} ${chalk_1.default.cyan(ASGARD_URL)}`);
        console.log(`  ${chalk_1.default.dim('The daemon is running in the background.')}`);
        console.log(`  ${chalk_1.default.dim('Logs:')} ${chalk_1.default.dim(logPath)}\n`);
    }
    else {
        spinner.fail(chalk_1.default.red('Daemon failed to start.'));
        console.log(`\n  ${chalk_1.default.dim('Check the log for details:')} ${chalk_1.default.yellow(logPath)}`);
        // Show last few lines of the log
        try {
            const log = fs_1.default.readFileSync(logPath, 'utf-8').trim().split('\n');
            const tail = log.slice(-5).join('\n');
            if (tail)
                console.log(`\n  ${chalk_1.default.dim(tail)}\n`);
        }
        catch (_) { /* ignore */ }
    }
}
async function stopDaemon() {
    const spinner = (0, ora_1.default)({ text: 'Stopping Asgard Gateway daemon...', prefixText: '  ' }).start();
    try {
        // Hard kill the process listening on the port (linux/mac)
        const port = ASGARD_URL.split(':').pop() || '8017';
        try {
            (0, child_process_1.execSync)(`lsof -t -i:${port} | xargs kill -9`);
            spinner.succeed(chalk_1.default.green('Daemon stopped.'));
        }
        catch (e) {
            spinner.info(chalk_1.default.yellow('Daemon was not running.'));
        }
    }
    catch (err) {
        spinner.fail(chalk_1.default.red('Failed to stop daemon: ' + err.message));
    }
}
async function openUi() {
    console.log(`\n  ${chalk_1.default.bold.cyan('Opening Asgard Dashboard')}\n`);
    try {
        await http.get('/health', { timeout: 1500 });
        let command = '';
        switch (process.platform) {
            case 'darwin':
                command = 'open';
                break;
            case 'win32':
                command = 'start';
                break;
            default:
                command = 'xdg-open';
                break;
        }
        (0, child_process_1.execSync)(`${command} ${ASGARD_URL}`);
        console.log(`  ${chalk_1.default.green('✔')} Opened ${chalk_1.default.cyan(ASGARD_URL)} in your browser.`);
    }
    catch (e) {
        console.log(`  ${chalk_1.default.red('✖')} The daemon must be running to open the dashboard.`);
        console.log(`  ${chalk_1.default.dim('Run "asgard start" first.')}`);
    }
    console.log();
}
async function configurePolicy() {
    console.log(`\n  ${chalk_1.default.bold.cyan('Configure Agent Policies')}\n`);
    const policyPath = path_1.default.resolve(__dirname, '../../api/config/agent_policies.json');
    if (!fs_1.default.existsSync(policyPath)) {
        console.log(`  ${chalk_1.default.red('✖')} Policy file not found at ${policyPath}`);
        return;
    }
    const policies = JSON.parse(fs_1.default.readFileSync(policyPath, 'utf8'));
    const profiles = Object.keys(policies);
    const { profile } = await inquirer_1.default.prompt([
        {
            type: 'list',
            name: 'profile',
            message: 'Select a policy profile to configure:',
            choices: profiles
        }
    ]);
    const opts = await inquirer_1.default.prompt([
        {
            type: 'number',
            name: 'maxDailySpendUSDC',
            message: 'Max Daily Spend (USDC):',
            default: policies[profile].maxDailySpendUSDC
        },
        {
            type: 'number',
            name: 'maxSingleTxUSDC',
            message: 'Max Single Transaction (USDC):',
            default: policies[profile].maxSingleTxUSDC
        },
        {
            type: 'number',
            name: 'maxTransactionsPerDay',
            message: 'Max Transactions Per Day:',
            default: policies[profile].maxTransactionsPerDay
        }
    ]);
    policies[profile].maxDailySpendUSDC = opts.maxDailySpendUSDC;
    policies[profile].maxSingleTxUSDC = opts.maxSingleTxUSDC;
    policies[profile].maxTransactionsPerDay = opts.maxTransactionsPerDay;
    fs_1.default.writeFileSync(policyPath, JSON.stringify(policies, null, 4));
    console.log(`\n  ${chalk_1.default.green('✔')} Policy '${profile}' updated successfully.`);
    console.log(`  ${chalk_1.default.dim('Changes will apply to all new transactions immediately.')}\n`);
}
async function provisionAgent() {
    console.log(`\n  ${chalk_1.default.bold.cyan('Provision New Agent Wallet')}\n`);
    const answers = await inquirer_1.default.prompt([
        {
            type: 'input',
            name: 'name',
            message: '  Agent name:',
            validate: (v) => v.trim().length > 0 || 'Name is required',
        },
        {
            type: 'list',
            name: 'policyProfile',
            message: '  Policy profile:',
            choices: [
                { name: 'default        — $50 USDC/day, 50 tx/day, Jupiter only', value: 'default' },
                { name: 'high_volume    — $500 USDC/day, 500 tx/day, extended tokens', value: 'high_volume' },
                { name: 'read_only      — Balance queries only, no transactions', value: 'read_only' },
            ],
        },
    ]);
    const spinner = (0, ora_1.default)({ text: 'Provisioning agent wallet...', prefixText: '  ' }).start();
    try {
        const { data } = await http.post('/v1/agents', { name: answers.name, policyProfile: answers.policyProfile }, { headers: nodeHeaders() });
        spinner.succeed(chalk_1.default.green('Agent wallet provisioned'));
        console.log();
        const table = new cli_table3_1.default({
            style: { head: [], border: [] },
            colWidths: [20, 66],
            wordWrap: true,
        });
        table.push([chalk_1.default.dim('Agent ID'), chalk_1.default.bold(data.agentId)], [chalk_1.default.dim('Name'), data.name], [chalk_1.default.dim('Wallet Address'), chalk_1.default.cyan(data.walletAddress)], [chalk_1.default.dim('Policy'), chalk_1.default.yellow(data.policyProfile)], [chalk_1.default.dim('Created'), chalk_1.default.dim(data.createdAt)], [chalk_1.default.dim('API Key'), chalk_1.default.bold.yellow(data.apiKey)]);
        console.log(table.toString());
        console.log();
        console.log(`  ${chalk_1.default.yellow.bold('⚠  Save the API Key above — it will NOT be shown again.')}`);
        console.log(`  ${chalk_1.default.dim('Fund the wallet on devnet:')}`);
        console.log(`  ${chalk_1.default.dim(`  solana airdrop 1 ${data.walletAddress} --url devnet`)}`);
    }
    catch (err) {
        spinner.fail(chalk_1.default.red('Provisioning failed'));
        handleApiError(err);
    }
}
async function listAgents() {
    const spinner = (0, ora_1.default)({ text: 'Fetching agents...', prefixText: '  ' }).start();
    try {
        const { data } = await http.get('/v1/agents', { headers: nodeHeaders() });
        spinner.succeed(`${chalk_1.default.green(data.count)} agent(s) registered`);
        console.log();
        if (data.count === 0) {
            console.log(`  ${chalk_1.default.dim('No agents found. Run "Provision New Agent" to create one.')}`);
            return;
        }
        const table = new cli_table3_1.default({
            head: [
                chalk_1.default.bold('Name'),
                chalk_1.default.bold('Policy'),
                chalk_1.default.bold('Wallet Address'),
                chalk_1.default.bold('Created'),
                chalk_1.default.bold('Active'),
            ],
            style: { head: [], border: [] },
            colWidths: [18, 14, 48, 24, 8],
        });
        for (const agent of data.agents) {
            table.push([
                agent.name,
                chalk_1.default.yellow(agent.policyProfile),
                chalk_1.default.cyan(agent.publicKey),
                chalk_1.default.dim(new Date(agent.createdAt).toLocaleString()),
                agent.active ? chalk_1.default.green('✔') : chalk_1.default.red('✖'),
            ]);
        }
        console.log(table.toString());
    }
    catch (err) {
        spinner.fail(chalk_1.default.red('Failed to fetch agents'));
        handleApiError(err);
    }
}
async function checkBalance() {
    console.log(`\n  ${chalk_1.default.bold.cyan('Check Agent Balance')}\n`);
    const answers = await inquirer_1.default.prompt([
        { type: 'input', name: 'agentId', message: '  Agent ID:' },
        { type: 'input', name: 'apiKey', message: '  Agent API Key:' },
    ]);
    const spinner = (0, ora_1.default)({ text: 'Fetching balances...', prefixText: '  ' }).start();
    try {
        const { data } = await http.get(`/v1/wallet/${answers.agentId}/balance`, {
            headers: agentHeaders(answers.apiKey),
        });
        spinner.succeed(chalk_1.default.green('Balances fetched'));
        console.log();
        const table = new cli_table3_1.default({ style: { head: [], border: [] } });
        table.push([chalk_1.default.dim('Agent ID'), data.agentId], [chalk_1.default.dim('Wallet'), chalk_1.default.cyan(data.address)], ...Object.entries(data.balances).map(([tok, amt]) => [
            chalk_1.default.dim(tok),
            chalk_1.default.yellow(String(amt)),
        ]), [chalk_1.default.dim('Queried'), chalk_1.default.dim(data.timestamp)]);
        console.log(table.toString());
    }
    catch (err) {
        spinner.fail(chalk_1.default.red('Balance fetch failed'));
        handleApiError(err);
    }
}
async function executeSwap() {
    console.log(`\n  ${chalk_1.default.bold.cyan('Execute Token Swap')}\n`);
    console.log(`  ${chalk_1.default.dim('The agent holds no private key. Asgard signs via the Vault.')}\n`);
    const answers = await inquirer_1.default.prompt([
        { type: 'input', name: 'agentId', message: '  Agent ID:' },
        { type: 'input', name: 'apiKey', message: '  Agent API Key:' },
        {
            type: 'list',
            name: 'inputToken',
            message: '  Swap from:',
            choices: ['USDC', 'SOL', 'BONK'],
        },
        {
            type: 'list',
            name: 'outputToken',
            message: '  Swap to:',
            choices: ['SOL', 'USDC', 'BONK'],
        },
        {
            type: 'number',
            name: 'amount',
            message: '  Amount:',
            validate: (v) => v > 0 || 'Must be positive',
        },
        {
            type: 'number',
            name: 'slippageBps',
            message: '  Slippage (bps, e.g. 50 = 0.5%):',
            default: 50,
        },
    ]);
    const spinner = (0, ora_1.default)({ text: 'Submitting swap intent to Asgard Gateway...', prefixText: '  ' }).start();
    try {
        const { data } = await http.post('/v1/intent/swap', {
            inputToken: answers.inputToken,
            outputToken: answers.outputToken,
            amount: answers.amount,
            slippageBps: answers.slippageBps,
        }, { headers: agentHeaders(answers.apiKey) });
        spinner.succeed(chalk_1.default.green('Swap confirmed on Solana Devnet!'));
        console.log();
        const table = new cli_table3_1.default({ style: { head: [], border: [] } });
        table.push([chalk_1.default.dim('Input'), `${chalk_1.default.yellow(answers.amount)} ${answers.inputToken}`], [chalk_1.default.dim('Output'), `${chalk_1.default.green(data.outputAmount.toFixed(6))} ${answers.outputToken}`], [chalk_1.default.dim('Price Impact'), data.priceImpactPct + '%'], [chalk_1.default.dim('Signature'), chalk_1.default.dim(data.signature)], [chalk_1.default.dim('Explorer'), explorerLink(data.signature)]);
        console.log(table.toString());
    }
    catch (err) {
        spinner.fail(chalk_1.default.red('Swap failed'));
        handleApiError(err);
    }
}
async function executeTransfer() {
    console.log(`\n  ${chalk_1.default.bold.cyan('Transfer Tokens')}\n`);
    const answers = await inquirer_1.default.prompt([
        { type: 'input', name: 'agentId', message: '  Agent ID:' },
        { type: 'input', name: 'apiKey', message: '  Agent API Key:' },
        {
            type: 'list',
            name: 'token',
            message: '  Token to send:',
            choices: ['SOL', 'USDC', 'BONK'],
        },
        {
            type: 'number',
            name: 'amount',
            message: '  Amount:',
            validate: (v) => v > 0 || 'Must be positive',
        },
        {
            type: 'input',
            name: 'destination',
            message: '  Destination address:',
            validate: (v) => (v.length >= 32 && v.length <= 44) || 'Enter a valid Solana base58 address',
        },
    ]);
    const { confirm } = await inquirer_1.default.prompt([
        {
            type: 'confirm',
            name: 'confirm',
            message: chalk_1.default.yellow(`  ⚠  Send ${answers.amount} ${answers.token} to ${answers.destination.slice(0, 12)}...?`),
            default: false,
        },
    ]);
    if (!confirm) {
        console.log(`  ${chalk_1.default.dim('Transfer cancelled.')}`);
        return;
    }
    const spinner = (0, ora_1.default)({ text: 'Submitting transfer intent...', prefixText: '  ' }).start();
    try {
        const { data } = await http.post('/v1/intent/transfer', {
            token: answers.token,
            amount: answers.amount,
            destination: answers.destination,
        }, { headers: agentHeaders(answers.apiKey) });
        spinner.succeed(chalk_1.default.green('Transfer confirmed on Solana Devnet!'));
        console.log();
        const table = new cli_table3_1.default({ style: { head: [], border: [] } });
        table.push([chalk_1.default.dim('Sent'), `${chalk_1.default.yellow(answers.amount)} ${answers.token}`], [chalk_1.default.dim('To'), chalk_1.default.cyan(answers.destination)], [chalk_1.default.dim('Signature'), chalk_1.default.dim(data.signature)], [chalk_1.default.dim('Explorer'), explorerLink(data.signature)]);
        console.log(table.toString());
    }
    catch (err) {
        spinner.fail(chalk_1.default.red('Transfer failed'));
        handleApiError(err);
    }
}
async function runDemo() {
    console.log(`\n  ${chalk_1.default.bold.cyan('Run AI Agent Demo Simulation')}\n`);
    console.log(`  ${chalk_1.default.dim('This demo will:')}`);
    console.log(`  ${chalk_1.default.dim('  1. Create a fresh agent wallet')}`);
    console.log(`  ${chalk_1.default.dim('  2. Simulate a market evaluation')}`);
    console.log(`  ${chalk_1.default.dim('  3. Execute a swap — without holding a private key')}\n`);
    const { proceed } = await inquirer_1.default.prompt([
        { type: 'confirm', name: 'proceed', message: '  Start demo?', default: true },
    ]);
    if (!proceed)
        return;
    // Step 1: Provision
    let spinner = (0, ora_1.default)({ text: 'Step 1/3 — Provisioning TradingBot-DEMO...', prefixText: '  ' }).start();
    try {
        const { data: agent } = await http.post('/v1/agents', { name: 'TradingBot-DEMO', policyProfile: 'default' });
        spinner.succeed(`Agent provisioned: ${chalk_1.default.cyan(agent.walletAddress)}`);
        // Step 2: Check balance
        spinner = (0, ora_1.default)({ text: 'Step 2/3 — Evaluating market conditions...', prefixText: '  ' }).start();
        await new Promise((r) => setTimeout(r, 1500));
        spinner.succeed(`Market signal: ${chalk_1.default.green('SOL oversold — buy signal detected')}`);
        // Step 3: Try swap (will likely fail without funded wallet, which is expected)
        spinner = (0, ora_1.default)({ text: 'Step 3/3 — Submitting swap intent to Asgard...', prefixText: '  ' }).start();
        try {
            const { data: swap } = await http.post('/v1/intent/swap', { inputToken: 'USDC', outputToken: 'SOL', amount: 10, slippageBps: 50 }, { headers: agentHeaders(agent.apiKey) });
            spinner.succeed(chalk_1.default.green('Swap confirmed! ' + swap.signature));
            console.log(`\n  ${chalk_1.default.dim('Explorer:')} ${explorerLink(swap.signature)}`);
        }
        catch (swapErr) {
            if (axios_1.default.isAxiosError(swapErr) && swapErr.response?.data?.code) {
                spinner.warn(chalk_1.default.yellow(`Policy/balance check: ${swapErr.response.data.code}`));
                console.log(`  ${chalk_1.default.dim('Expected in demo — fund the wallet with USDC on devnet to run live.')}`);
            }
            else {
                spinner.warn(chalk_1.default.yellow('Swap failed — fund wallet with USDC on devnet to run live.'));
            }
        }
        console.log();
        console.log(DIVIDER);
        console.log(`\n  ${chalk_1.default.bold.green('✔  Demo complete. Agent never held a private key.')}`);
        console.log(`  ${chalk_1.default.dim('API Key: ')}${chalk_1.default.yellow(agent.apiKey)}`);
        console.log(`  ${chalk_1.default.dim('Fund at: solana airdrop 0.5')} ${chalk_1.default.cyan(agent.walletAddress)} ${chalk_1.default.dim('--url devnet')}\n`);
    }
    catch (err) {
        spinner.fail(chalk_1.default.red('Demo failed'));
        handleApiError(err);
    }
}
// ─── Main Menu ────────────────────────────────────────────────────────────────
async function mainMenu() {
    console.clear();
    console.log(LOGO);
    console.log(DIVIDER);
    while (true) {
        console.log();
        const { action } = await inquirer_1.default.prompt([
            {
                type: 'list',
                name: 'action',
                message: chalk_1.default.bold('  What do you want to do?'),
                choices: [
                    new inquirer_1.default.Separator(chalk_1.default.dim('  ── Setup & Lifecycle ────────────────────')),
                    { name: '  🚀  Initialize Local Node', value: 'init' },
                    { name: '  🟢  Start Daemon', value: 'start' },
                    { name: '  🔴  Stop Daemon', value: 'stop' },
                    { name: '  🔍  Check Gateway Status', value: 'health' },
                    { name: '  💻  Open Web Dashboard', value: 'open' },
                    { name: '  🛡️  Configure Agent Policies', value: 'policy' },
                    new inquirer_1.default.Separator(chalk_1.default.dim('  ── Agent Management ─────────────────────')),
                    { name: '  🤖  Provision New Agent Wallet', value: 'provision' },
                    { name: '  📋  List All Agents', value: 'list' },
                    new inquirer_1.default.Separator(chalk_1.default.dim('  ── Agent Operations ─────────────────────')),
                    { name: '  💰  Check Agent Balance', value: 'balance' },
                    { name: '  🔁  Execute Token Swap', value: 'swap' },
                    { name: '  📤  Transfer Tokens', value: 'transfer' },
                    new inquirer_1.default.Separator(chalk_1.default.dim('  ── Demo ─────────────────────────────────')),
                    { name: '  🎯  Run AI Agent Demo Simulation', value: 'demo' },
                    new inquirer_1.default.Separator(chalk_1.default.dim('  ─────────────────────────────────────────')),
                    { name: '  ✖   Exit', value: 'exit' },
                ],
                pageSize: 16,
            },
        ]);
        console.log();
        switch (action) {
            case 'init':
                await initNode();
                break;
            case 'start':
                await startDaemon();
                break;
            case 'stop':
                await stopDaemon();
                break;
            case 'health':
                await checkHealth();
                break;
            case 'open':
                await openUi();
                break;
            case 'policy':
                await configurePolicy();
                break;
            case 'provision':
                await provisionAgent();
                break;
            case 'list':
                await listAgents();
                break;
            case 'balance':
                await checkBalance();
                break;
            case 'swap':
                await executeSwap();
                break;
            case 'transfer':
                await executeTransfer();
                break;
            case 'demo':
                await runDemo();
                break;
            case 'exit':
                console.log(`\n  ${chalk_1.default.cyan.bold('Goodbye.')} Asgard CLI shutting down.\n`);
                process.exit(0);
        }
        // Pause before returning to menu
        await inquirer_1.default.prompt([
            { type: 'input', name: '_', message: chalk_1.default.dim('  Press Enter to return to menu...') },
        ]);
        console.clear();
        console.log(LOGO);
        console.log(DIVIDER);
    }
}
// ─── Entry Point ──────────────────────────────────────────────────────────────
commander_1.program
    .name('asgard')
    .description('Asgard CLI — Operator Command Center')
    .version('1.0.0');
commander_1.program
    .command('ui')
    .description('Open the interactive CLI dashboard (default)')
    .action(async () => {
    try {
        await mainMenu();
    }
    catch (err) {
        console.error(chalk_1.default.red('\nFatal error:'), err.message);
        process.exit(1);
    }
});
commander_1.program.command('init').description('Initialize Local Asgard Node').action(initNode);
commander_1.program.command('start').description('Start the Asgard Gateway daemon').action(startDaemon);
commander_1.program.command('stop').description('Stop the Asgard Gateway daemon').action(stopDaemon);
commander_1.program.command('health').description('Check gateway status').action(checkHealth);
commander_1.program.command('open').description('Open the web dashboard in your browser').action(openUi);
commander_1.program.command('policy').description('Configure agent policies interactively').action(configurePolicy);
commander_1.program.command('provision').description('Provision a new agent wallet interactively').action(provisionAgent);
commander_1.program.command('list').description('List all registered agents').action(listAgents);
if (process.argv.length === 2) {
    // If no args passed, default to interactive UI
    mainMenu().catch((err) => {
        console.error(chalk_1.default.red('\nFatal error:'), err.message);
        process.exit(1);
    });
}
else {
    commander_1.program.parseAsync(process.argv).catch(err => {
        console.error(chalk_1.default.red('\nFatal error:'), err.message);
        process.exit(1);
    });
}
//# sourceMappingURL=index.js.map