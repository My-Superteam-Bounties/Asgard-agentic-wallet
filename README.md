<img alt="Asgard Logo" src="https://github.com/user-attachments/assets/78dbc377-a060-4afe-92cd-d2a95c4794d6" width="200">

# Asgard — Institutional-Grade Agentic Wallet

Asgard is a **Local Companion Node** that gives AI agents autonomous, policy-governed access to the Solana blockchain — without ever exposing a private key to the agent itself. Think of it like a Phantom or Solflare wallet, but instead of a human clicking "Approve", the Asgard daemon enforces spending policies and signs for the local AI agent automatically.

Built specifically for the **Superteam AI Agent Wallet Bounty**.

---

## 🏆 Bounty Requirements Checklist

This project proudly fulfills every single requirement of the Superteam Bounty:

- [x] **Create a wallet programmatically:** Agents use the `x-wallet provision` tool to generate AES-256-GCM encrypted keypairs on the fly.
- [x] **Sign transactions automatically:** The local Asgard daemon decrypts the vault in-memory, signs the transaction, and zeroes the memory. The AI agent never touches the raw private key.
- [x] **Hold SOL or SPL tokens:** The `x-wallet transfer` tool allows agents to autonomously send and receive SOL/USDC on the Devnet.
- [x] **Interact with a protocol:** We interact intimately with the SPL Token Program and System Program.
- [x] **Multi-Agent Test Harness (Working Prototype):** Run `npm run demo` to watch 3 distinct AI Agents provision wallets, request funding, and autonomously trade with each other in an infinite loop.
- [x] **Open-source code:** You are looking at it! Full monorepo architecture.
- [x] **Deep Dive & SKILLS.md:** Provided in the root directory.

---

## ✨ Key Features

1. **Dual-Layer CLI System:** 
   - `asgard` (Human CLI) configures the node, sets the Master Password, and boots the backend daemon.
   - `x-wallet` (Agent CLI) provides structured JSON outputs dynamically designed to be invoked as a *LangChain* or *n8n* structured tool by LLMs.
2. **Real-Time WebSockets Dashboard:** 
   - Visit `http://localhost:8017` to view your fleet of agents.
   - The React UI utilizes Socket.IO to stream live events. Watch as new agents are provisioned and transactions are executed in real-time.
3. **Institutional Security Vault:** 
   - AES-256-GCM encryption with PBKDF2 key derivation.
   - Private keys are completely zeroed from the Node.js memory buffer within milliseconds of signing.
4. **Auto-Injected Authentication:** 
   - Zero-config dashboard. The daemon serves the React app and automatically injects authentication tokens for `localhost` requests, keeping it secure but frictionless for local operators.

---

## ⚙️ Prerequisites

Before you begin, ensure you have the following installed on your machine:

- **Node.js**: v18.0.0 or higher (v20+ recommended).
- **pnpm**: Fast, disk space efficient package manager.
  - To install pnpm: `npm install -g pnpm`
- **Rust / Cargo**: Required to compile and run the Kora Node binary.
  - To install Rust: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- **Git**: To clone the repository.

---

## 🚀 Installation & Setup

Follow these exact steps to clone, build, and run the Asgard ecosystem locally.

### 1. Clone the Repository
```bash
git clone https://github.com/My-Superteam-Bounties/Asgard-agentic-wallet.git
cd asgard-agent-wallet
```

### 2. Install Dependencies
Using `pnpm` workspace functionality, install dependencies for all packages simultaneously:
```bash
pnpm install
```

### 3. Build the Monorepo
Compile the TypeScript source code for the API daemon, the React frontend, and the CLI tools:
```bash
pnpm build
```

*(Optional: Link globally so you can use `asgard` and `x-wallet` anywhere on your machine)*
```bash
npm install -g .
```

---

## 🎮 Running the Platform

### Step 1: Initialize the Local Node
Just like setting up Phantom for the first time, you need to initialize your secure vault:

```bash
# If you didn't install globally, use: pnpm --filter @asgard/cli start init
asgard init
```
* **Security Prompt:** You will be forced to create a **Master Encryption Password**. It MUST be at least 16 characters long. This password encrypts the underlying wallets.

### Step 2: Start the Kora Paymaster Core
Asgard achieves true gasless transactions by routing intents mapping to a fully functional **Kora JSON-RPC Server**. To run this prototype locally, you must install the Kora CLI and fund a local operator keypair:

```bash
# 1. Install Kora CLI globally
cargo install kora-cli

# 2. Ensure you have a Solana CLI keypair (Kora uses this as the SOL fee payer)
# We store this inside ~/.asgard to avoid overwriting your personal dev wallets!
mkdir -p ~/.asgard/keys
solana-keygen new -o ~/.asgard/keys/kora-signer.json --no-bip39-passphrase --force

# 3. Fund your local fee payer with Devnet SOL so it can sponsor agent transactions
solana airdrop 2 ~/.asgard/keys/kora-signer.json --url devnet

# 4. Boot the paymaster using our pre-configured Kora definitions
kora rpc start --config apps/api/kora/kora.toml --signers-config apps/api/kora/signers.toml
```

### Step 3: Start the Daemon & Dashboard
Boot the backend daemon. This starts the Express server, initializes the WebSocket streams, and serves the React dashboard.

```bash
# If you didn't install globally, use: pnpm --filter @asgard/cli start start
asgard start
```

* **The Dashboard:** Open your browser and navigate to `http://localhost:8017`. You will see the beautiful Asgard control center.

### Step 4: Run the AI Agent Demo!
To prove the system works, we built a Test Harness that fakes 3 autonomous bots interacting with Asgard.

Leave your `asgard start` daemon running in one terminal. Open a **new terminal tab**, ensure you are in the root of this repository, and run:

```bash
npm run demo
```

**What happens next?**
1. Watch the terminal as 3 mock agents (`Alice-Trader`, `Bob-Liquidity`, `Charlie-Arber`) use the `x-wallet provision` tool to create secure wallets.
2. Jump over to your Web Dashboard (`http://localhost:8017`). You will physically see the agents pop up in the "Registered Agents" table via Real-Time WebSockets!
3. The script will pause and ask you to send Devnet SOL to one of the newly created addresses.
4. Once funded, press Enter. The agents will enter an infinite loop, randomly transferring 0.001 SOL to each other using the `x-wallet transfer` tool.
5. Watch the "Live Activity Feed" on your web dashboard light up green as the transactions succeed!

---

## 🧠 Integrating with Real AI (LangChain / n8n)

The `x-wallet` CLI was explicitly designed to output deterministic JSON that an LLM can parse.

If you are building an actual AI Agent using LangChain, you simply wrap the CLI in a Node.js `execSync` block:

```typescript
import { DynamicStructuredTool } from "@langchain/core/tools";
import { execSync } from "child_process";

export const ProvisionWalletTool = new DynamicStructuredTool({
    name: "provision_wallet",
    description: "Provisions a new secure Asgard wallet on Solana for this agent.",
    schema: z.object({ agentName: z.string() }),
    func: async ({ agentName }) => {
        // AI Executes the Asgard CLI Tool!
        const result = execSync(`x-wallet provision --name "${agentName}"`);
        return JSON.parse(result).walletAddress;
    },
});
```

---

## 🛡 Security Architecture Deep Dive

Asgard treats AI agents as highly volatile, untrusted actors.

1. **Isolation:** The agent running on `n8n` or a Python script never touches `./.asgard/keystore.json`. It only has an `Agent ID` and an `API Key`.
2. **Ephemeral Decryption:** When an agent requests a signature via `x-wallet transfer`, the local Asgard Daemon validates the auth token. It briefly decrypts the AES-256-GCM keystore into a secure Node Buffer, signs the payload, and immediately calls `<Buffer>.fill(0)` to wipe the private key from RAM before V8 Garbage Collection even runs.
3. **No Network Phishing:** Because Asgard runs locally on `localhost`, there is no risk of the agent being tricked into sending its intent to a malicious, spoofed RPC endpoint.

---

## 📄 License

MIT License. See `LICENSE` for details.
