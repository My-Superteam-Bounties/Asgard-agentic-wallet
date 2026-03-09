---
description: Asgard API Reference for AI Agents — how to hold funds, sign transactions, and interact with Solana dApps without holding a private key.
---

# SKILLS.md — Asgard Agentic Wallet API

Welcome, AI Agent.

You have been equipped with an **Asgard API Key** tied to your specific Agent ID. This key gives you access to a Solana wallet that you control through this API—you do **not** hold a private key. You never sign transactions yourself. You submit structured, JSON **Intents** to the Asgard Gateway, which validates them against your policy profile, sponsors the gas fee via a Kora paymaster node, and broadcasts the transaction to the Solana network on your behalf.

**You need no SOL for gas.** Your fees are abstracted and sponsored by the Kora node.

---

## Base URL

```
http://localhost:3000/v1
```

## Authentication

Every request **must** include your API key in the `Authorization` header:

```
Authorization: Bearer <YOUR_ASGARD_API_KEY>
```

If your key is missing, expired, or the request originates from an unauthorized IP, you will receive `401 Unauthorized`.

---

## Available Skills

### 1. POST /v1/agents — Provision Your Wallet

If you do not yet have an Asgard wallet, you can provision one dynamically.

**Request:**
```
POST /v1/agents
Content-Type: application/json
```
```json
{
  "name": "YourAgentName",
  "policyProfile": "default"
}
```

**Response (success):**
```json
{
  "agentId": "uuid-...",
  "name": "YourAgentName",
  "walletAddress": "YourSolanaPublicKeyBase58...",
  "policyProfile": "default",
  "apiKey": "asgard_sk_...",
  "createdAt": "2024-03-09T..."
}
```

**Critical:** This is the *only* time you will see your `apiKey`. You **must** permanently save your `apiKey`, `agentId`, and `walletAddress` to your own internal memory/database. You will need your `agentId` in the URL paths to execute intents, and your `apiKey` in the headers.

---

### 2. GET /wallet/:agentId/balance — Check Your Balance

Retrieve your current on-chain balances.

**Request:**
```
GET /v1/wallet/{YOUR_AGENT_ID}/balance
Authorization: Bearer asgard_sk_...
```

**Response:**
```json
{
  "address": "YourSolanaPublicKeyBase58...",
  "balances": {
    "SOL": 0.0,
    "USDC": 120.50,
    "wSOL": 0.0
  }
}
```

**Decision guidance:** If your USDC balance is 0, you cannot execute swaps. Do not attempt swap intents.

---

### 3. POST /intent/transfer — Transfer SPL Tokens

Send SPL tokens (or SOL) to another Solana address.

**Request:**
```
POST /v1/intent/transfer
Authorization: Bearer asgard_sk_...
Content-Type: application/json
```
```json
{
  "token": "USDC",
  "amount": 10.0,
  "destination": "TargetWalletAddressBase58..."
}
```

**Response (success):**
```json
{
  "status": "success",
  "signature": "5aRtXyz...",
  "explorerUrl": "https://explorer.solana.com/tx/5aRtXyz...?cluster=devnet"
}
```

**Notes:**
- `token` accepts: `"SOL"`, `"USDC"`, `"wSOL"`, or a raw SPL Mint address.
- `destination` must be a valid Solana base58 public key.
- You do **not** need SOL for fees — the Kora node sponsors the gas.

---

### 4. POST /intent/swap — Swap Tokens via Jupiter

Swap one token for another using the Jupiter v6 aggregator.

**Request:**
```
POST /v1/intent/swap
Authorization: Bearer asgard_sk_...
Content-Type: application/json
```
```json
{
  "inputToken": "USDC",
  "outputToken": "SOL",
  "amount": 25.0,
  "slippageBps": 50
}
```

**Response (success):**
```json
{
  "status": "success",
  "inputAmount": 25.0,
  "outputAmount": 0.1523,
  "signature": "3kTy...",
  "explorerUrl": "https://explorer.solana.com/tx/3kTy...?cluster=devnet"
}
```

**Notes:**
- `slippageBps` is denominated in basis points. `50` = 0.5%. Recommended: `50`–`150`.
- Only token pairs supported by Jupiter v6 on Devnet are valid.
- If Jupiter cannot find a route, you will receive a `400 Bad Request` with reason `"NO_ROUTE_FOUND"`. Consider a different token pair or lower amount.

---

## Policy Violations — How to Handle Them

Your wallet has hardcoded spending policies. If your intent breaches these policies, you will receive a `403 Forbidden` response:

```json
{
  "error": "PolicyViolation",
  "code": "SPEND_LIMIT_EXCEEDED",
  "message": "This intent exceeds your daily spend limit of 50 USDC.",
  "dailyRemaining": 12.50
}
```

**Common error codes and how to respond:**

| Code | Meaning | What to Do |
|---|---|---|
| `SPEND_LIMIT_EXCEEDED` | You have hit your daily USD spend cap | Lower the `amount` or wait until your limit resets at UTC midnight |
| `PROGRAM_NOT_WHITELISTED` | The target dApp is not on your approved list | Do not retry. This program is not permitted for your agent |
| `VELOCITY_LIMIT_EXCEEDED` | Too many requests in a short window | Wait 60 seconds before retrying |
| `INSUFFICIENT_BALANCE` | Not enough token balance on-chain | Acquire more tokens before retrying |
| `DESTINATION_BLOCKED` | The target address is on a blocklist | Do not send to this address |

---

## Critical Rules for Agents

1. **Never store or transmit your API key** to other agents or external services.
2. **Always check your balance** before submitting a swap or transfer intent to avoid avoidable rejections.
3. **If you receive `PolicyViolation`**, do NOT retry the same transaction in a loop. Re-evaluate your goal and choose a different action.
4. **Respect rate limits.** Exceeding 100 requests/minute to the API will result in temporary suspension.
