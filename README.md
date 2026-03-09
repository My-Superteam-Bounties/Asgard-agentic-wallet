# 🛡 Asgard — Institutional-Grade Agentic Wallet for AI on Solana

Asgard is a **Wallet-as-a-Service** that gives AI agents autonomous, policy-governed access to the Solana blockchain — without ever exposing a private key to the agent itself.

Built for the [Superteam AI Agent Wallet Bounty](https://superteam.fun).

---

## How It Works

```
AI Agent (n8n / LangChain / custom)
        │  REST API intent  (JSON)
        ▼
 ┌─────────────────────────────┐
 │     Asgard Gateway (API)    │  ← validates, enforces policy
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

The agent is **never told** the private key. It only submits **Intents** (what to do). Asgard decides **if it's allowed** and **handles the signing**.

---

## Repository Structure

```
asgard/
├── apps/
│   ├── api/          ← Asgard Gateway API server (Node.js / Express / TypeScript)
│   ├── cli/          ← Asgard CLI operator tool
│   └── webapp/       ← Asgard Dashboard (React / Vite)
├── docs/
│   ├── DESIGN.md     ← Architecture deep-dive for bounty judges
│   └── SKILLS.md     ← API reference for AI agents
└── integrations/
    └── n8n/
        └── Asgard_Trader_Workflow.json   ← Import into n8n to see a live agent
```

---

## Quick Start

### 1. Start the API Server

```bash
cd apps/api
cp .env.example .env        # fill in ASGARD_MASTER_PASSWORD and ASGARD_ADMIN_KEY
npm install
npm run dev
# → http://localhost:3000
```

### 2. Run the CLI

```bash
cd apps/cli
cp .env.example .env        # set ASGARD_URL and ASGARD_ADMIN_KEY
npm install
npm start
```

### 3. Open the Dashboard

```bash
cd apps/webapp
cp .env.example .env
npm install
npm run dev
# → http://localhost:5173
```

### 4. Run Kora Gas Node (optional, for gasless transactions)

```bash
cargo install kora-cli
kora-cli --config apps/api/kora/kora.toml run
```

---

## Key Features

| Feature | Detail |
|---|---|
| **Programmatic wallet creation** | `POST /v1/agents` — generates a fresh Solana keypair |
| **Encrypted key storage** | AES-256-GCM with PBKDF2 key derivation, zeroed from memory after use |
| **Policy engine** | Per-agent spend limits, program whitelists, velocity checks |
| **Gasless transactions** | Kora node sponsors all network fees — agents need zero SOL |
| **Jupiter v6 swaps** | Native DEX aggregator integration |
| **SPL token transfers** | Full transfer support with `TransferChecked` for safety |
| **n8n compatible** | REST API works directly as HTTP Request node |
| **CLI operator tool** | Full management interface from the terminal |
| **React dashboard** | Live agent monitoring and intent execution |

---

## For Judges

- **Deep dive:** [`docs/DESIGN.md`](docs/DESIGN.md)
- **Agent API reference:** [`docs/SKILLS.md`](docs/SKILLS.md)
- **n8n demo workflow:** [`integrations/n8n/Asgard_Trader_Workflow.json`](integrations/n8n/Asgard_Trader_Workflow.json)

---

## Security Model

Asgard uses a **strict three-layer separation**:

1. **The Brain** — AI agent, submits JSON intents, holds no key material
2. **The Gateway** — Validates intents against per-agent policies
3. **The Vault** — Decrypts and signs transiently, zeroes key bytes immediately

Private keys are encrypted at rest with `AES-256-GCM`. The encryption key is derived with `PBKDF2` (210,000 iterations) from a master password stored as an environment variable — never in code.

---

## License

MIT
