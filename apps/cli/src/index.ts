#!/usr/bin/env node
/**
 * Asgard CLI — Operator Command Center
 *
 * A feature-rich terminal interface for managing AI agent wallets.
 * Communicates with the Asgard Gateway via HTTP API — no direct imports from @asgard/api.
 *
 * Usage: npx ts-node src/index.ts
 */

import chalk from 'chalk';
import inquirer from 'inquirer';
import Table from 'cli-table3';
import ora from 'ora';
import axios, { AxiosInstance } from 'axios';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomBytes } from 'crypto';
import dotenv from 'dotenv';
import { fork, execSync } from 'child_process';
import { program } from 'commander';

// ─── Configuration ────────────────────────────────────────────────────────────

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
    timeout: 15000,
});

// ─── ANSI Art & Branding ─────────────────────────────────────────────────────

const LOGO = `
${chalk.cyan.bold('   █████╗ ███████╗ ██████╗  █████╗ ██████╗ ██████╗ ')}
${chalk.cyan.bold(' ██╔══██╗██╔════╝██╔════╝ ██╔══██╗██╔══██╗██╔══██╗')}
${chalk.cyan.bold(' ███████║███████╗██║  ███╗███████║██████╔╝██║  ██║')}
${chalk.cyan.bold(' ██╔══██║╚════██║██║   ██║██╔══██║██╔══██╗██║  ██║')}
${chalk.cyan.bold(' ██║  ██║███████║╚██████╔╝██║  ██║██║  ██║██████╔╝')}
${chalk.cyan.bold(' ╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ')}

${chalk.dim('  Institutional-Grade Agentic Wallet for AI on Solana')}
${chalk.dim('  ─────────────────────────────────────────────────────')}
${chalk.dim(`  Gateway: ${ASGARD_URL}`)}
`;

const DIVIDER = chalk.dim('  ' + '─'.repeat(58));

// ─── Utility Helpers ─────────────────────────────────────────────────────────

function nodeHeaders() {
    return { Authorization: `Bearer ${NODE_KEY}` };
}

function agentHeaders(apiKey: string) {
    return { Authorization: `Bearer ${apiKey}` };
}

function explorerLink(sig: string): string {
    return chalk.cyan.underline(`https://explorer.solana.com/tx/${sig}?cluster=devnet`);
}

function formatBalance(balances: Record<string, number>): string {
    return Object.entries(balances)
        .map(([token, amount]) => `${chalk.bold(token)}: ${chalk.yellow(amount.toFixed(4))}`)
        .join('  │  ');
}

function handleApiError(err: unknown): never {
    if (axios.isAxiosError(err)) {
        const data = err.response?.data;
        if (data?.code) {
            console.log(`\n  ${chalk.red('✖')} ${chalk.bold('Policy Violation:')} ${data.code}`);
            console.log(`  ${chalk.dim(data.message)}`);
            if (data.dailyRemaining !== undefined) {
                console.log(`  ${chalk.dim(`Daily remaining: $${data.dailyRemaining} USDC`)}`);
            }
        } else if (err.code === 'ECONNREFUSED') {
            console.log(`\n  ${chalk.red('✖')} Cannot reach Asgard Gateway at ${ASGARD_URL}`);
            console.log(`  ${chalk.dim('Make sure the API server is running: pnpm api')}`);
        } else {
            console.log(`\n  ${chalk.red('✖')} ${data?.message || err.message}`);
        }
    } else {
        console.log(`\n  ${chalk.red('✖')} ${String(err)}`);
    }
    process.exit(1);
}

// ─── Commands ─────────────────────────────────────────────────────────────────

async function initNode() {
    console.log(`\n  ${chalk.bold.cyan('Initialize Local Asgard Node')}\n`);
    console.log(`  ${chalk.dim('Setup your Master Encryption Password securely.')}`);
    console.log(`  ${chalk.dim('This password never leaves your machine and encrypts all agent wallets.')}\n`);

    const asgardDir = path.join(os.homedir(), '.asgard');
    if (fs.existsSync(path.join(asgardDir, '.env'))) {
        const { overwrite } = await inquirer.prompt([
            { type: 'confirm', name: 'overwrite', message: '  ⚠  .asgard configuration already exists. Overwrite?', default: false }
        ]);
        if (!overwrite) return;
    }

    const answers = await inquirer.prompt([
        {
            type: 'password',
            name: 'password',
            message: '  Create Master Password:',
            mask: '*',
            validate: (v: string) => v.length >= 16 || 'Password must be at least 16 characters long for AES-256 encryption.',
        },
        {
            type: 'input',
            name: 'rpcUrl',
            message: '  Solana RPC URL (Devnet/Mainnet):',
            default: 'https://api.devnet.solana.com',
        }
    ]);

    const spinner = ora({ text: 'Generating secure Node Key and configuring environment...', prefixText: '  ' }).start();

    try {
        if (!fs.existsSync(asgardDir)) {
            fs.mkdirSync(asgardDir, { mode: 0o700, recursive: true });
        }

        const nodeKey = `asgard_node_${randomBytes(16).toString('hex')}`;
        const envContent = `ASGARD_MASTER_PASSWORD="${answers.password}"\nSOLANA_RPC_URL="${answers.rpcUrl}"\nASGARD_NODE_KEY="${nodeKey}"\nSOLANA_NETWORK="devnet"\nKEYSTORE_PATH="${path.join(asgardDir, 'keystore')}"\n`;

        fs.writeFileSync(path.join(asgardDir, '.env'), envContent, { mode: 0o600 });

        spinner.succeed(chalk.green('Local node configuration saved! (~/.asgard/.env)'));
        console.log(`\n  ${chalk.green('✔')} You're all set! Start the daemon with: ${chalk.cyan('asgard start')}\n`);
        process.exit(0);
    } catch (err: any) {
        spinner.fail(chalk.red('Failed to initialize node'));
        console.log(`  ${chalk.red(err.message)}`);
    }
}

async function checkHealth() {
    const spinner = ora({ text: 'Checking gateway status...', prefixText: '  ' }).start();
    try {
        const { data } = await http.get('/health');
        spinner.succeed(chalk.green('Gateway is online'));
        console.log();
        const table = new Table({ style: { head: [], border: [] } });
        table.push(
            [chalk.dim('Service'), data.service],
            [chalk.dim('Version'), data.version],
            [chalk.dim('Network'), chalk.yellow(data.network)],
            [chalk.dim('Status'), chalk.green(data.status)],
            [chalk.dim('Timestamp'), chalk.dim(data.timestamp)]
        );
        console.log(table.toString());
    } catch (err) {
        spinner.fail(chalk.red('Gateway unreachable'));
        handleApiError(err);
    }
}

async function startDaemon() {
    console.log(`\n  ${chalk.bold.cyan('Start Asgard Daemon')}\n`);

    // ── Pre-flight: ensure the node has been initialized ──────────────────
    const asgardDir = path.join(os.homedir(), '.asgard');
    const envFile = path.join(asgardDir, '.env');
    if (!fs.existsSync(envFile)) {
        console.log(`  ${chalk.red('✖')} Asgard has not been initialized yet.`);
        console.log(`  ${chalk.dim('Run')} ${chalk.cyan('asgard init')} ${chalk.dim('to create your master password and configure the node.')}\n`);
        return;
    }

    // Check if API is already running
    try {
        await http.get('/health', { timeout: 1500 });
        console.log(`  ${chalk.green('✔')} Daemon is already running at ${ASGARD_URL}`);
        return;
    } catch (e) {
        // Expected to fail if not running
    }

    const apiPath = path.resolve(__dirname, '../../api/dist/server.js');
    if (!fs.existsSync(apiPath)) {
        console.log(`  ${chalk.red('✖')} Could not find API server at: ${apiPath}`);
        console.log(`  ${chalk.dim('Make sure you have run: pnpm build')}`);
        return;
    }

    const spinner = ora({ text: 'Starting Asgard Gateway daemon...', prefixText: '  ' }).start();

    // Write daemon stdout/stderr to a log file so errors are never lost
    const logPath = path.join(asgardDir, 'daemon.log');
    const logFd = fs.openSync(logPath, 'a');

    // Force reload the env in case the user just ran init or edited the file
    // Otherwise passing process.env to fork will pass the old cached values
    require('dotenv').config({ path: envFile, override: true });

    // Spawn the API server as a detached background process
    const child = fork(apiPath, [], {
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
        } catch (_) {
            // Keep retrying
        }
    }

    if (booted) {
        spinner.succeed(chalk.green('Daemon started successfully!'));
        console.log(`\n  ${chalk.bold('Dashboard:')} ${chalk.cyan(ASGARD_URL)}`);
        console.log(`  ${chalk.dim('The daemon is running in the background.')}`);
        console.log(`  ${chalk.dim('Logs:')} ${chalk.dim(logPath)}\n`);
    } else {
        spinner.fail(chalk.red('Daemon failed to start.'));
        console.log(`\n  ${chalk.dim('Check the log for details:')} ${chalk.yellow(logPath)}`);
        // Show last few lines of the log
        try {
            const log = fs.readFileSync(logPath, 'utf-8').trim().split('\n');
            const tail = log.slice(-5).join('\n');
            if (tail) console.log(`\n  ${chalk.dim(tail)}\n`);
        } catch (_) { /* ignore */ }
    }
}

async function stopDaemon() {
    const spinner = ora({ text: 'Stopping Asgard Gateway daemon...', prefixText: '  ' }).start();
    try {
        // Hard kill the process listening on the port (linux/mac)
        const port = ASGARD_URL.split(':').pop() || '8017';
        try {
            execSync(`lsof -t -i:${port} | xargs kill -9`);
            spinner.succeed(chalk.green('Daemon stopped.'));
        } catch (e) {
            spinner.info(chalk.yellow('Daemon was not running.'));
        }
    } catch (err: any) {
        spinner.fail(chalk.red('Failed to stop daemon: ' + err.message));
    }
}

async function openUi() {
    console.log(`\n  ${chalk.bold.cyan('Opening Asgard Dashboard')}\n`);
    try {
        await http.get('/health', { timeout: 1500 });
        let command = '';
        switch (process.platform) {
            case 'darwin': command = 'open'; break;
            case 'win32': command = 'start'; break;
            default: command = 'xdg-open'; break;
        }
        execSync(`${command} ${ASGARD_URL}`);
        console.log(`  ${chalk.green('✔')} Opened ${chalk.cyan(ASGARD_URL)} in your browser.`);
    } catch (e) {
        console.log(`  ${chalk.red('✖')} The daemon must be running to open the dashboard.`);
        console.log(`  ${chalk.dim('Run "asgard start" first.')}`);
    }
    console.log();
}

async function configurePolicy() {
    console.log(`\n  ${chalk.bold.cyan('Configure Agent Policies')}\n`);

    const policyPath = path.resolve(__dirname, '../../api/config/agent_policies.json');
    if (!fs.existsSync(policyPath)) {
        console.log(`  ${chalk.red('✖')} Policy file not found at ${policyPath}`);
        return;
    }

    const policies = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
    const profiles = Object.keys(policies);

    const { profile } = await inquirer.prompt([
        {
            type: 'list',
            name: 'profile',
            message: 'Select a policy profile to configure:',
            choices: profiles
        }
    ]);

    const opts = await inquirer.prompt([
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

    fs.writeFileSync(policyPath, JSON.stringify(policies, null, 4));
    console.log(`\n  ${chalk.green('✔')} Policy '${profile}' updated successfully.`);
    console.log(`  ${chalk.dim('Changes will apply to all new transactions immediately.')}\n`);
}

async function provisionAgent() {
    console.log(`\n  ${chalk.bold.cyan('Provision New Agent Wallet')}\n`);

    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'name',
            message: '  Agent name:',
            validate: (v: string) => v.trim().length > 0 || 'Name is required',
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

    const spinner = ora({ text: 'Provisioning agent wallet...', prefixText: '  ' }).start();

    try {
        const { data } = await http.post(
            '/v1/agents',
            { name: answers.name, policyProfile: answers.policyProfile },
            { headers: nodeHeaders() }
        );
        spinner.succeed(chalk.green('Agent wallet provisioned'));

        console.log();
        const table = new Table({
            style: { head: [], border: [] },
            colWidths: [20, 66],
            wordWrap: true,
        });
        table.push(
            [chalk.dim('Agent ID'), chalk.bold(data.agentId)],
            [chalk.dim('Name'), data.name],
            [chalk.dim('Wallet Address'), chalk.cyan(data.walletAddress)],
            [chalk.dim('Policy'), chalk.yellow(data.policyProfile)],
            [chalk.dim('Created'), chalk.dim(data.createdAt)],
            [chalk.dim('API Key'), chalk.bold.yellow(data.apiKey)]
        );
        console.log(table.toString());
        console.log();
        console.log(`  ${chalk.yellow.bold('⚠  Save the API Key above — it will NOT be shown again.')}`);
        console.log(`  ${chalk.dim('Fund the wallet on devnet:')}`);
        console.log(`  ${chalk.dim(`  solana airdrop 1 ${data.walletAddress} --url devnet`)}`);
    } catch (err) {
        spinner.fail(chalk.red('Provisioning failed'));
        handleApiError(err);
    }
}

async function listAgents() {
    const spinner = ora({ text: 'Fetching agents...', prefixText: '  ' }).start();

    try {
        const { data } = await http.get('/v1/agents', { headers: nodeHeaders() });
        spinner.succeed(`${chalk.green(data.count)} agent(s) registered`);
        console.log();

        if (data.count === 0) {
            console.log(`  ${chalk.dim('No agents found. Run "Provision New Agent" to create one.')}`);
            return;
        }

        const table = new Table({
            head: [
                chalk.bold('Name'),
                chalk.bold('Policy'),
                chalk.bold('Wallet Address'),
                chalk.bold('Created'),
                chalk.bold('Active'),
            ],
            style: { head: [], border: [] },
            colWidths: [18, 14, 48, 24, 8],
        });

        for (const agent of data.agents) {
            table.push([
                agent.name,
                chalk.yellow(agent.policyProfile),
                chalk.cyan(agent.publicKey),
                chalk.dim(new Date(agent.createdAt).toLocaleString()),
                agent.active ? chalk.green('✔') : chalk.red('✖'),
            ]);
        }

        console.log(table.toString());
    } catch (err) {
        spinner.fail(chalk.red('Failed to fetch agents'));
        handleApiError(err);
    }
}

async function checkBalance() {
    console.log(`\n  ${chalk.bold.cyan('Check Agent Balance')}\n`);

    const answers = await inquirer.prompt([
        { type: 'input', name: 'agentId', message: '  Agent ID:' },
        { type: 'input', name: 'apiKey', message: '  Agent API Key:' },
    ]);

    const spinner = ora({ text: 'Fetching balances...', prefixText: '  ' }).start();

    try {
        const { data } = await http.get(`/v1/wallet/${answers.agentId}/balance`, {
            headers: agentHeaders(answers.apiKey),
        });
        spinner.succeed(chalk.green('Balances fetched'));

        console.log();
        const table = new Table({ style: { head: [], border: [] } });
        table.push(
            [chalk.dim('Agent ID'), data.agentId],
            [chalk.dim('Wallet'), chalk.cyan(data.address)],
            ...Object.entries(data.balances).map(([tok, amt]) => [
                chalk.dim(tok),
                chalk.yellow(String(amt)),
            ]),
            [chalk.dim('Queried'), chalk.dim(data.timestamp)]
        );
        console.log(table.toString());
    } catch (err) {
        spinner.fail(chalk.red('Balance fetch failed'));
        handleApiError(err);
    }
}

async function executeSwap() {
    console.log(`\n  ${chalk.bold.cyan('Execute Token Swap')}\n`);
    console.log(`  ${chalk.dim('The agent holds no private key. Asgard signs via the Vault.')}\n`);

    const answers = await inquirer.prompt([
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
            validate: (v: number) => v > 0 || 'Must be positive',
        },
        {
            type: 'number',
            name: 'slippageBps',
            message: '  Slippage (bps, e.g. 50 = 0.5%):',
            default: 50,
        },
    ]);

    const spinner = ora({ text: 'Submitting swap intent to Asgard Gateway...', prefixText: '  ' }).start();

    try {
        const { data } = await http.post(
            '/v1/intent/swap',
            {
                inputToken: answers.inputToken,
                outputToken: answers.outputToken,
                amount: answers.amount,
                slippageBps: answers.slippageBps,
            },
            { headers: agentHeaders(answers.apiKey) }
        );
        spinner.succeed(chalk.green('Swap confirmed on Solana Devnet!'));

        console.log();
        const table = new Table({ style: { head: [], border: [] } });
        table.push(
            [chalk.dim('Input'), `${chalk.yellow(answers.amount)} ${answers.inputToken}`],
            [chalk.dim('Output'), `${chalk.green(data.outputAmount.toFixed(6))} ${answers.outputToken}`],
            [chalk.dim('Price Impact'), data.priceImpactPct + '%'],
            [chalk.dim('Signature'), chalk.dim(data.signature)],
            [chalk.dim('Explorer'), explorerLink(data.signature)]
        );
        console.log(table.toString());
    } catch (err) {
        spinner.fail(chalk.red('Swap failed'));
        handleApiError(err);
    }
}

async function executeTransfer() {
    console.log(`\n  ${chalk.bold.cyan('Transfer Tokens')}\n`);

    const answers = await inquirer.prompt([
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
            validate: (v: number) => v > 0 || 'Must be positive',
        },
        {
            type: 'input',
            name: 'destination',
            message: '  Destination address:',
            validate: (v: string) =>
                (v.length >= 32 && v.length <= 44) || 'Enter a valid Solana base58 address',
        },
    ]);

    const { confirm } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'confirm',
            message: chalk.yellow(`  ⚠  Send ${answers.amount} ${answers.token} to ${answers.destination.slice(0, 12)}...?`),
            default: false,
        },
    ]);

    if (!confirm) {
        console.log(`  ${chalk.dim('Transfer cancelled.')}`);
        return;
    }

    const spinner = ora({ text: 'Submitting transfer intent...', prefixText: '  ' }).start();

    try {
        const { data } = await http.post(
            '/v1/intent/transfer',
            {
                token: answers.token,
                amount: answers.amount,
                destination: answers.destination,
            },
            { headers: agentHeaders(answers.apiKey) }
        );
        spinner.succeed(chalk.green('Transfer confirmed on Solana Devnet!'));

        console.log();
        const table = new Table({ style: { head: [], border: [] } });
        table.push(
            [chalk.dim('Sent'), `${chalk.yellow(answers.amount)} ${answers.token}`],
            [chalk.dim('To'), chalk.cyan(answers.destination)],
            [chalk.dim('Signature'), chalk.dim(data.signature)],
            [chalk.dim('Explorer'), explorerLink(data.signature)]
        );
        console.log(table.toString());
    } catch (err) {
        spinner.fail(chalk.red('Transfer failed'));
        handleApiError(err);
    }
}

async function runDemo() {
    console.log(`\n  ${chalk.bold.cyan('Run AI Agent Demo Simulation')}\n`);
    console.log(`  ${chalk.dim('This demo will:')}`);
    console.log(`  ${chalk.dim('  1. Create a fresh agent wallet')}`);
    console.log(`  ${chalk.dim('  2. Simulate a market evaluation')}`);
    console.log(`  ${chalk.dim('  3. Execute a swap — without holding a private key')}\n`);

    const { proceed } = await inquirer.prompt([
        { type: 'confirm', name: 'proceed', message: '  Start demo?', default: true },
    ]);

    if (!proceed) return;

    // Step 1: Provision
    let spinner = ora({ text: 'Step 1/3 — Provisioning TradingBot-DEMO...', prefixText: '  ' }).start();
    try {
        const { data: agent } = await http.post(
            '/v1/agents',
            { name: 'TradingBot-DEMO', policyProfile: 'default' }
        );
        spinner.succeed(`Agent provisioned: ${chalk.cyan(agent.walletAddress)}`);

        // Step 2: Check balance
        spinner = ora({ text: 'Step 2/3 — Evaluating market conditions...', prefixText: '  ' }).start();
        await new Promise((r) => setTimeout(r, 1500));
        spinner.succeed(`Market signal: ${chalk.green('SOL oversold — buy signal detected')}`);

        // Step 3: Try swap (will likely fail without funded wallet, which is expected)
        spinner = ora({ text: 'Step 3/3 — Submitting swap intent to Asgard...', prefixText: '  ' }).start();
        try {
            const { data: swap } = await http.post(
                '/v1/intent/swap',
                { inputToken: 'USDC', outputToken: 'SOL', amount: 10, slippageBps: 50 },
                { headers: agentHeaders(agent.apiKey) }
            );
            spinner.succeed(chalk.green('Swap confirmed! ' + swap.signature));
            console.log(`\n  ${chalk.dim('Explorer:')} ${explorerLink(swap.signature)}`);
        } catch (swapErr) {
            if (axios.isAxiosError(swapErr) && swapErr.response?.data?.code) {
                spinner.warn(chalk.yellow(`Policy/balance check: ${swapErr.response.data.code}`));
                console.log(`  ${chalk.dim('Expected in demo — fund the wallet with USDC on devnet to run live.')}`);
            } else {
                spinner.warn(chalk.yellow('Swap failed — fund wallet with USDC on devnet to run live.'));
            }
        }

        console.log();
        console.log(DIVIDER);
        console.log(`\n  ${chalk.bold.green('✔  Demo complete. Agent never held a private key.')}`);
        console.log(`  ${chalk.dim('API Key: ')}${chalk.yellow(agent.apiKey)}`);
        console.log(`  ${chalk.dim('Fund at: solana airdrop 0.5')} ${chalk.cyan(agent.walletAddress)} ${chalk.dim('--url devnet')}\n`);
    } catch (err) {
        spinner.fail(chalk.red('Demo failed'));
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
        const { action } = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: chalk.bold('  What do you want to do?'),
                choices: [
                    new inquirer.Separator(chalk.dim('  ── Setup & Lifecycle ────────────────────')),
                    { name: '  🚀  Initialize Local Node', value: 'init' },
                    { name: '  🟢  Start Daemon', value: 'start' },
                    { name: '  🔴  Stop Daemon', value: 'stop' },
                    { name: '  🔍  Check Gateway Status', value: 'health' },
                    { name: '  💻  Open Web Dashboard', value: 'open' },
                    { name: '  🛡️  Configure Agent Policies', value: 'policy' },
                    new inquirer.Separator(chalk.dim('  ── Agent Management ─────────────────────')),
                    { name: '  🤖  Provision New Agent Wallet', value: 'provision' },
                    { name: '  📋  List All Agents', value: 'list' },
                    new inquirer.Separator(chalk.dim('  ── Agent Operations ─────────────────────')),
                    { name: '  💰  Check Agent Balance', value: 'balance' },
                    { name: '  🔁  Execute Token Swap', value: 'swap' },
                    { name: '  📤  Transfer Tokens', value: 'transfer' },
                    new inquirer.Separator(chalk.dim('  ── Demo ─────────────────────────────────')),
                    { name: '  🎯  Run AI Agent Demo Simulation', value: 'demo' },
                    new inquirer.Separator(chalk.dim('  ─────────────────────────────────────────')),
                    { name: '  ✖   Exit', value: 'exit' },
                ],
                pageSize: 16,
            },
        ]);

        console.log();

        switch (action) {
            case 'init': await initNode(); break;
            case 'start': await startDaemon(); break;
            case 'stop': await stopDaemon(); break;
            case 'health': await checkHealth(); break;
            case 'open': await openUi(); break;
            case 'policy': await configurePolicy(); break;
            case 'provision': await provisionAgent(); break;
            case 'list': await listAgents(); break;
            case 'balance': await checkBalance(); break;
            case 'swap': await executeSwap(); break;
            case 'transfer': await executeTransfer(); break;
            case 'demo': await runDemo(); break;
            case 'exit':
                console.log(`\n  ${chalk.cyan.bold('Goodbye.')} Asgard CLI shutting down.\n`);
                process.exit(0);
        }

        // Pause before returning to menu
        await inquirer.prompt([
            { type: 'input', name: '_', message: chalk.dim('  Press Enter to return to menu...') },
        ]);
        console.clear();
        console.log(LOGO);
        console.log(DIVIDER);
    }
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

program
    .name('asgard')
    .description('Asgard CLI — Operator Command Center')
    .version('1.0.0');

program
    .command('ui')
    .description('Open the interactive CLI dashboard (default)')
    .action(async () => {
        try {
            await mainMenu();
        } catch (err: any) {
            console.error(chalk.red('\nFatal error:'), err.message);
            process.exit(1);
        }
    });

program.command('init').description('Initialize Local Asgard Node').action(initNode);
program.command('start').description('Start the Asgard Gateway daemon').action(startDaemon);
program.command('stop').description('Stop the Asgard Gateway daemon').action(stopDaemon);
program.command('health').description('Check gateway status').action(checkHealth);
program.command('open').description('Open the web dashboard in your browser').action(openUi);
program.command('policy').description('Configure agent policies interactively').action(configurePolicy);
program.command('provision').description('Provision a new agent wallet interactively').action(provisionAgent);
program.command('list').description('List all registered agents').action(listAgents);

if (process.argv.length === 2) {
    // If no args passed, default to interactive UI
    mainMenu().catch((err) => {
        console.error(chalk.red('\nFatal error:'), err.message);
        process.exit(1);
    });
} else {
    program.parseAsync(process.argv).catch(err => {
        console.error(chalk.red('\nFatal error:'), err.message);
        process.exit(1);
    });
}
