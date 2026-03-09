# 🛡 Asgard — "Phantom for AI Agents"

Asgard is a **Local Companion Node** that gives AI agents autonomous, policy-governed access to the Solana blockchain — without ever exposing a private key to the agent itself. Think of it like a Phantom or Solflare wallet, but instead of a human clicking "Approve", the Asgard daemon enforces spending policies and signs for the local AI agent automatically.

Built for the [Superteam AI Agent Wallet Bounty](https://superteam.fun/earn/listing/defi-developer-challenge-agentic-wallets-for-ai-agents).

---

## The Two CLIs

When you install Asgard, you get two distinct CLI tools:

1. **`asgard`** (The Human Operator): You use this to configure your Master Password, boot the background daemon, and view the web dashboard.
2. **`x-wallet`** (The AI Agent): The AI agent uses this in its shell environment to execute trades, transfers, and wallet generation programmatically. It outputs strictly formatted JSON.

---

## How It Works

```
AI Agent (n8n / LangChain / custom)
        │  Executes CLI Intent  (e.g., x-wallet swap)
        ▼
 ┌─────────────────────────────┐
 │    Local Asgard Daemon      │  ← validates, enforces policy
 │   Policy Engine  ·  Auth    │
 └────────────┬────────────────┘
              │ approved
              ▼
 ┌─────────────────────────────┐
 │       AsgardVault           │  ← only component that touches keys
 │  AES-256-GCM Keystore       │  ← private key never leaves
 └────────────┬────────────────┘
              │ signed tx
              ▼
 ┌─────────────────────────────┐
 │  Kora Gas Abstraction Node  │  ← co-signs as feePayer
 └────────────┬────────────────┘
              │
              ▼
        Solana Blockchain
```

---

## Quick Start

### 1. Build and Install Globally

You (the human operator) build the project and link it globally so the `asgard` and `x-wallet` commands are available system-wide:

```bash
pnpm install
pnpm build
npm install -g .
```

### 2. Initialize the Local Node

Just like setting up Phantom, initialize Asgard securely on your machine:

```bash
asgard
# Select "Initialize Local Node"
```

This prompts you to create a **Master Encryption Password** (must be at least 16 characters) which encrypts all agent wallets via AES-256-GCM. It generates a secure `~/.asgard/.env` file containing your password and a random `ASGARD_NODE_KEY` used for authenticating your `x-wallet` commands.

### 3. Start the Daemon

```bash
asgard
# Select "Start Daemon"
```
*The daemon boots in the background. Visit `http://localhost:3000` to view the React Dashboard.*

### 4. Give the Agent the `x-wallet` CLI

Now, your AI agent can provision its own wallet and execute transactions locally:

```bash
# Agent provisions a wallet
x-wallet provision --name "Trading-Bot"

# Agent executes a swap
x-wallet swap --agent-id <UUID> --api-key <API_KEY> --in USDC --out SOL -a 10
```

---

## Key Features

| Feature | Detail |
|---|---|
| **Programmatic wallet creation** | `x-wallet provision` — generates a fresh Solana keypair |
| **Encrypted key storage** | AES-256-GCM with PBKDF2 key derivation, zeroed from memory after use |
| **Policy engine** | Per-agent spend limits, program whitelists, velocity checks |
| **Gasless transactions** | Kora node sponsors all network fees — agents need zero SOL |
| **CLI agent interface** | The `x-wallet` command makes it trivial for AI to interact |
| **React dashboard** | Served directly by the local daemon for human monitoring |

---

## For Judges

- **Deep dive:** [`docs/DESIGN.md`](docs/DESIGN.md)
- **Agent API reference:** [`docs/SKILLS.md`](docs/SKILLS.md)

---

## Security Model

Asgard uses a **strict three-layer separation**:

1. **The Brain** — AI agent, executes CLI commands, holds no key material
2. **The Gateway** — Validates intents against per-agent policies
3. **The Vault** — Decrypts and signs transiently, zeroes key bytes immediately

Private keys are encrypted at rest with `AES-256-GCM`. The encryption key is derived with `PBKDF2` (210,000 iterations) from a master password stored in `~/.asgard/.env` — never in code.

---

## License

MIT
