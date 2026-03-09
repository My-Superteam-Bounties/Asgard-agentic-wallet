/**
 * Multi-Agent Test Harness (Devnet Simulation)
 * 
 * This script demonstrates multiple autonomous AI Agents managing their own
 * isolated wallets via the Asgard daemon.
 * 
 * Flow:
 * 1. Provision 3 agents (Alice, Bob, Charlie).
 * 2. Check their Devnet SOL balances.
 * 3. Pause for human to airdrop SOL to at least one of them.
 * 4. Enter an autonomous loop where agents randomly send SOL to each other.
 */

const { execSync } = require('child_process');
const readline = require('readline');

// The 3 simulated agents
const AGENT_NAMES = ['Alice-Trader', 'Bob-Liquidity', 'Charlie-Arber'];
const agents = [];

// Helper to run x-wallet CLI commands and parse the JSON output
function runAgentCommand(command) {
    try {
        // x-wallet outputs logs to stderr and pure JSON to stdout.
        // We only want the JSON output for parsing.
        const output = execSync(`x-wallet ${command}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
        return JSON.parse(output.trim());
    } catch (err) {
        console.error(`\n❌ Agent Command Failed: x-wallet ${command.split(' ')[0]}`);
        let message = err.message;
        if (err.stdout) {
            try {
                const parsed = JSON.parse(err.stdout.trim());
                message = parsed.message || JSON.stringify(parsed);
            } catch (e) {
                message = err.stdout.toString();
            }
        }
        console.error(`   Error: ${message.trim()}`);
        return null;
    }
}

// Pause utility
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (query) => new Promise((resolve) => rl.question(query, resolve));
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    console.log('\n🤖 =======================================================');
    console.log('🤖 Asgard AI Simulation: Multi-Agent Devnet Economy');
    console.log('🤖 =======================================================\n');

    // 1. Provision Agents
    console.log('⏳ Booting up autonomous agents...\n');
    for (const name of AGENT_NAMES) {
        process.stdout.write(`   Provisioning [${name}]... `);
        const res = runAgentCommand(`provision --name "${name}"`);
        if (res && res.agentId) {
            agents.push(res);
            console.log(`✅ Ready! Address: ${res.walletAddress}`);
        } else {
            console.log('❌ Failed');
        }
    }

    if (agents.length < 2) {
        console.error('\n❌ Need at least 2 agents to run the simulation.');
        process.exit(1);
    }

    // 2. Initial Balances & Funding
    console.log('\n⏳ Checking agent balances on Devnet...\n');
    let hasFunds = false;

    for (const agent of agents) {
        const bal = runAgentCommand(`balance --agent-id ${agent.agentId} --api-key ${agent.apiKey}`);
        const sol = bal ? bal.balances.SOL : 0;
        console.log(`   [${agent.name}]  Balance: ${sol} SOL`);
        if (sol > 0.01) hasFunds = true;
    }

    if (!hasFunds) {
        console.log('\n⚠️  None of the agents have ENOUGH funds to start trading.');
        console.log('⚠️  Please airdrop some Devnet SOL to at least one of these addresses:');
        agents.forEach(a => console.log(`      - ${a.walletAddress}`));
        console.log('\n   Or run: solana airdrop 1 <ADDRESS> -u devnet');

        await question('\nPress [ENTER] once you have sent funds to start the autonomous loop...');
    } else {
        console.log('\n✅ Sufficient system liquidity detected.');
        await sleep(2000);
    }

    // 3. Autonomous Trading Loop
    console.log('\n🚀 Starting autonomous trading simulation...');
    console.log('   (Watch your React Dashboard "Live Activity Feed" to see real-time updates!)\n');

    let cycle = 1;
    while (true) {
        console.log(`--- [ Cycle ${cycle} ] ----------------------------------------`);

        // Pick random sender and receiver
        const sender = agents[Math.floor(Math.random() * agents.length)];
        let receiver = agents[Math.floor(Math.random() * agents.length)];
        while (receiver.agentId === sender.agentId) {
            receiver = agents[Math.floor(Math.random() * agents.length)];
        }

        // Random amount between 0.001 and 0.005
        const amount = (Math.random() * 0.004 + 0.001).toFixed(3);

        console.log(`🤖 Agent [${sender.name}] decided to send ${amount} SOL to [${receiver.name}]`);

        const transferRes = runAgentCommand(`transfer --agent-id ${sender.agentId} --api-key ${sender.apiKey} --token SOL --amount ${amount} --destination ${receiver.walletAddress}`);

        if (transferRes && transferRes.status === 'success') {
            console.log(`✅ Success! TxHash: ${transferRes.signature}`);
        } else {
            console.log(`⚠️ Transfer failed or rejected by policy.`);
        }

        // Wait 8-12 seconds before the next trade
        const delay = Math.floor(Math.random() * 4000) + 8000;
        console.log(`⏳ Waiting ${delay / 1000} seconds before next cycle...\n`);
        await sleep(delay);
        cycle++;
    }
}

main().catch(console.error);
