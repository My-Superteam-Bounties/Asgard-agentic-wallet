# Asgard: The Institutional-Grade Agentic Wallet for AI on Solana

> **"Think Solflare, but for AI Agents."**
> 
> A Local Companion Node (sidecar) protocol enabling autonomous AI agents to hold funds, sign transactions, manage liquidity, and interact with Solana dApps—without holding a private key and without human intervention.

---

## 🎯 What Is Asgard?

Asgard is a **secure, sandboxed API gateway** that sits between an AI agent's reasoning engine and the Solana blockchain. It provides the missing infrastructure layer for the AI Agent era: a wallet that machines can control without catastrophic security tradeoffs.

The critical insight driving Asgard's design:

> **An agent that signs its own transactions is a security disaster waiting to happen. An agent that submits *intents* to a policy-enforced, Kora-sponsored gateway is production-ready.**

---

## ✅ Bounty Requirements Coverage

| Requirement | Implementation |
|---|---|
| Create a wallet programmatically | REST API: `POST /v1/agents` allows agents to autonomously generate a new `ed25519` Keypair, which is encrypted AES-256-GCM. Returns an Agent ID + API Key |
| Sign transactions automatically | Policy-gated signing inside the isolated Vault layer; no human intervention |
| Hold SOL or SPL tokens | Every provisioned agent wallet is a native Solana address capable of holding SOL and SPL tokens |
| Interact with a test dApp or protocol | Jupiter Swap integration on Devnet; agents can request token swaps via `POST /v1/intent/swap` |
| Deep dive on design & security | This `DESIGN.md` document |
| Open-source with README | `README.md` with full setup instructions |
| SKILLS.md for agents | `SKILLS.md` provides the API reference for AI agents |
| Working prototype on devnet | Local CLI simulation + n8n workflow demo on Devnet |
| Scalability: multiple agents | Each agent is independently provisioned with unique keypair, API key, and policy ruleset |

---

## 🏗️ Core Architecture: Three-Layer Separation of Concerns

```
┌─────────────────────────────────────────────────────────┐
│            THE BRAIN (AI Agent / python / bash)         │
│  • Makes decisions based on prompts or triggers          │
│  • Holds ONLY an Asgard API Key — never a private key    │
│  • Executes local shell commands: `x-wallet swap ...`    │
└─────────────────────┬───────────────────────────────────┘
                      │  CLI Intent (x-wallet)
                      ▼
┌─────────────────────────────────────────────────────────┐
│          THE GATEWAY (Asgard Policy Engine)              │
│  • Validates API Key & IP whitelist                      │
│  • Runs the Intent through the Policy ruleset            │
│    - Spend limits ✓  - Velocity checks ✓                 │
│    - Program whitelist ✓  - Account blocklist ✓          │
│  • Assigns Kora FeePayer to the transaction              │
│  • Forwards approved Intents to The Vault               │
└─────────────────────┬───────────────────────────────────┘
                      │  Approved Intent
                      ▼
┌─────────────────────────────────────────────────────────┐
│          THE VAULT (Key Management & Signing)            │
│  • The ONLY component with access to encrypted keys      │
│  • Builds a Solana Versioned Transaction                 │
│  • Signs with the agent's AES-256-GCM encrypted keypair  │
│  • Kora node co-signs as FeePayer (gasless for agent)   │
│  • Broadcasts signed transaction via Solana JSON RPC     │
└─────────────────────┬───────────────────────────────────┘
                      │  Signed & Broadcast
                      ▼
                 Solana Devnet / Mainnet
```

**The key principle:** The Brain (AI) decides *what* to do. The Gateway decides *if it's permitted*. The Vault decides *how to sign it*. These layers are strictly isolated and never share state or keys.

---

## 🔑 How Wallets Are Created on Solana

Solana wallets are `ed25519` cryptographic key pairs. A wallet is simply:
- A **Public Key** (32 bytes): The on-chain address, safe to share.
- A **Private Key** (64 bytes): Signs transactions. **This must never be exposed.**

When a new agent is provisioned via Asgard's API:

1. `Keypair.generate()` from `@solana/web3.js` creates a fresh `ed25519` keypair.
2. The private key bytes are immediately encrypted with **AES-256-GCM** using a master key loaded from environment/KMS at boot time.
3. The encrypted blob is stored in the persistent keystore. The raw private key bytes are zeroed from memory immediately after encryption.
4. A UUIDv4 Agent ID and a cryptographically random API key are generated and returned to the caller.

The agent's public key (wallet address) is returned to the caller and can be funded with SOL/SPL tokens from a faucet or airdrop.

---

## ⛽ Gas Abstraction: Kora Nodes Explained

### The Problem
AI agents holding only SPL tokens (e.g., USDC) can't pay Solana network fees, which require native SOL. Forcing agents to maintain a minimum SOL balance ("dust") is operationally fragile.

### The Kora Solution
**Kora** is an open-source Solana paymaster service (written in Rust, distributed as the `kora-cli` crate). Asgard runs a Kora node that acts as a **gas sponsor** for all agent transactions.

**How it works in practice:**

1. Asgard builds a Solana `VersionedTransaction` for the agent's intent.
2. The transaction's `feePayer` field is set to the **Kora node's sponsor wallet address** — not the agent's wallet.
3. Kora validates the transaction against its `kora.toml` policies (program allowlists, fee caps, token allowlists).
4. If valid, Kora signs the transaction as the fee payer, injecting real SOL from its sponsor balance to cover the network fee.
5. The cost recovery model: Kora can subtract the equivalent fee in the agent's SPL token (e.g., USDC) during the transaction itself, or the operator can choose to subsidize agents completely.

**Key Kora configuration that Asgard uses:**

```toml
# kora.toml (Asgard's Kora Node Configuration)

[kora]
rate_limit = 100

[kora.auth]
hmac_secret = "kora_hmac_your-32-char-secret-here"
max_timestamp_age = 300

[validation]
price_source = "Jupiter"
max_allowed_lamports = 1000000
max_signatures = 5
allow_durable_transactions = false

allowed_programs = [
  "11111111111111111111111111111111",           # System Program
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", # SPL Token
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL", # Associated Token
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",  # Jupiter v6
]

allowed_tokens = [
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", # USDC
  "So11111111111111111111111111111111111111112",     # wSOL
]

# Fee payer cannot do arbitrary transfers — hardcoded protection
[validation.fee_payer_policy.system]
allow_transfer = false
allow_create_account = false

[validation.fee_payer_policy.spl_token]
allow_transfer = false
allow_burn = false
allow_approve = false

[validation.price]
type = "margin"
margin = 0.15  # 15% margin on network fees for sustainability
```

**Signer options for the Kora node** (from official docs): Local private key (prototype), or production-grade options like [Turnkey](https://www.turnkey.com/), [Privy](https://www.privy.io/), or [HashiCorp Vault](https://developer.hashicorp.com/vault).

---

## 🔒 Security Architecture & Threat Model

### Threat 1: Prompt Injection / Rogue Agent
An attacker manipulates an AI agent to request a transfer of all funds to a malicious address.

**Asgard Defense:**
- The Policy Engine checks every Intent against hardcoded, code-level rules before any transaction is built.
- Spend limits (e.g., max 50 USDC/day) prevent fund drainage.
- Destination whitelists ensure transfers only go to explicitly approved addresses.
- Kora's own `disallowed_accounts` blocklist provides a second layer of filtering at the protocol level.

### Threat 2: Server Compromise
An attacker gains OS-level access to the Asgard server.

**Asgard Defense:**
- Keys are AES-256-GCM encrypted at rest. A compromised server only yields encrypted blobs, not raw keys.
- In production, signer keys live in **AWS KMS** or **HashiCorp Vault** — where even an OS root user cannot export raw key material.
- The Kora node runs as a separate process. Compromising the Asgard API does not automatically compromise the Kora FeePayer key.

### Threat 3: API Key Theft
An attacker steals an agent's API Key and impersonates it.

**Asgard Defense:**
- Every agent's API key is scoped to a specific set of permissions (e.g., `swap:write`, `transfer:write`, or read-only).
- **Localhost Trust**: Asgard is designed to run as a *local sidecar* on the exact same VPS or laptop as the agent itself.
- **HMAC Signatures**: Sensitive operations require HMAC-signed request bodies with a timestamp to prevent replay attacks limit attack surfaces.
- API keys can be revoked instantly via the Node Key without affecting the underlying wallet.

### Threat 4: Transaction Replay Attacks
An attacker intercepts a signed transaction and attempts to re-broadcast it.

**Asgard Defense:**
- All Solana transactions include a recent blockhash that expires within ~90 seconds. Replaying them after expiry fails at the network level.
- Durable nonces are **explicitly disabled** in the Kora configuration (`allow_durable_transactions = false`) to prevent a class of replay exploits.

---

## 🤖 External Agent Integration

Asgard operates as a local Daemon with a direct CLI interface (`x-wallet`). This makes it trivially straightforward to integrate with agents built in Python, TypeScript, or bash.

**Workflow:**
1. A python LangChain agent decides: "is SOL price below my buy threshold?"
2. The agent executes a shell command: `subprocess.run("x-wallet swap --in USDC --out SOL -a 10", shell=True)`
3. The `x-wallet` CLI streams the intent to the local daemon, which processes it, sponsors the gas via Kora, and lands the transaction on Devnet.
4. The `x-wallet` CLI outputs strictly formatted JSON (the signature and result) to `stdout` which the Python script effortlessly parses.

The agent never sees or stores the wallet private key. It only needs its Asgard API Key.

---

## 📈 Scalability: Multi-Agent Architecture

Asgard is designed as a multi-tenant service:

- A single developer can run one Asgard local instance to manage **thousands of custom agent wallets** independently.
- Each agent has its own: Keypair, API Key, Usage Limits, and Policy Ruleset.
- Kora's Redis-based per-wallet usage limiting (`max_transactions = 100`) prevents any one rogue agent from bankrupting the gas sponsor.
- Agent isolation means a compromised agent's API key cannot query, access, or transact on behalf of any other agent.
- To scale the signing layer, Kora supports **multi-signer configurations** for distributing transaction load and improving reliability.

---

## 🛠️ Technology Stack

| Component | Technology |
|---|---|
| API Gateway | Node.js + TypeScript + Express |
| Wallet Creation | `@solana/web3.js` (Keypair.generate) |
| Key Encryption | AES-256-GCM (Node.js `crypto` module) |
| Gas Abstraction | Kora CLI (`kora-cli` Rust binary) |
| DeFi Integration | Jupiter v6 Swap API |
| External Agent Support | REST API (n8n HTTP Request Node) |
| Network | Solana Devnet |

---

## 📋 Judging Criteria — Addressed

| Criteria | Evidence |
|---|---|
| **Functional Demonstration** | Node.js CLI Agent Simulation + n8n Workflow demo, both operating on Solana Devnet |
| **Security & Key Management** | AES-256-GCM encrypted keystore + Policy Engine + Kora fee_payer_policy hardening |
| **Clear Documentation** | `DESIGN.md` (this file), `README.md`, `SKILLS.md`, n8n JSON workflow file |
| **Scalability** | Multi-tenant API: each agent independently provisioned with isolated keys, policies, and usage limits |
| **Separation of Concerns** | Agent Brain → restful API Intents → Policy Engine → Vault Signing. Zero key exposure to the agent layer |
