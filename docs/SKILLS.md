---
description: Asgard API Reference for AI Agents — how to hold funds, sign transactions, and interact with Solana dApps without holding a private key.
---

# SKILLS.md — The `x-wallet` Agent Interface

Welcome, AI Agent.

You have been equipped with an **Asgard API Key** tied to your specific Agent ID. This key gives you access to a Solana wallet that you control through the local `x-wallet` CLI application—you do **not** hold a private key. You never sign transactions yourself. You execute `x-wallet` shell commands, which submit structured **Intents** to the Asgard Gateway daemon. 

**You need no SOL for gas.** Your fees are abstracted and sponsored by the Kora node.

---

## The Interface: `x-wallet`
You have access to a global command line binary called `x-wallet`. Every time you execute it, it outputs strictly formatted JSON that you can parse immediately.

**Pro Tip:** If you ever forget the exact flags for a command, you can run `x-wallet --help` or `x-wallet <command> --help` directly in your shell to see the full list of required and optional arguments!

---

## Available Skills

### 1. Provision Your Wallet

If you do not yet have an Asgard wallet, you can provision one dynamically.
**Note:** Your human operator must provide you with their local `ASGARD_NODE_KEY` (or it must be in the `~/.asgard/.env` file) to execute this.

**Command:**
```bash
x-wallet provision --name "YourAgentName" --policy "default"
```

**JSON Stderr Response (success):**
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

**Critical:** This is the *only* time you will see your `apiKey`. You **must** permanently save your `apiKey`, `agentId`, and `walletAddress` to your own internal memory/database. You will need them for all subsequent `x-wallet` commands.

> [!WARNING]
> If you receive an `InternalServerError` stating **"ASGARD_MASTER_PASSWORD must be at least 16 characters"**, this means your human operator set up the Asgard daemon insecurely. Instruct them to stop the daemon and run `asgard init` to configure a proper 16-character encryption key before you can provision your wallet.

---

### 2. Check Your Balance

Retrieve your current on-chain balances.

**Command:**
```bash
x-wallet balance --agent-id <YOUR_AGENT_ID> --api-key <YOUR_API_KEY>
```

**JSON response:**
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

### 3. Check Transaction History

Retrieve your recent on-chain transactions (up to 10 by default) to verify if an incoming payment (like a bounty) has arrived, or to verify if your past swaps succeeded.

**Command:**
```bash
x-wallet history --agent-id <YOUR_AGENT_ID> --api-key <YOUR_API_KEY> --limit 5
```

**JSON response:**
```json
{
  "agentId": "uuid-...",
  "address": "YourSolanaPublicKeyBase58...",
  "history": [
    {
      "signature": "5aRtXyz...",
      "slot": 123456789,
      "err": null,
      "memo": null,
      "blockTime": "2024-03-09T18:30:00.000Z",
      "explorerUrl": "https://explorer.solana.com/tx/5aRtXyz...?cluster=devnet"
    }
  ],
  "timestamp": "2024-03-09T..."
}
```

**Decision guidance:** If `err` is `null`, the transaction was successful. You can use the `explorerUrl` to view the specific token transfers in a browser if needed.

---

### 4. Transfer SPL Tokens

Send SPL tokens (or SOL) to another Solana address.

**Command:**
```bash
x-wallet transfer --agent-id <YOUR_AGENT_ID> --api-key <YOUR_API_KEY> --token USDC --amount 10.0 --destination <TargetWalletAddressBase58>
```

**JSON response (success):**
```json
{
  "status": "success",
  "signature": "5aRtXyz...",
  "explorerUrl": "https://explorer.solana.com/tx/5aRtXyz...?cluster=devnet"
}
```

---

### 5. Swap Tokens via Jupiter

Swap one token for another using the Jupiter v6 aggregator.

**Command:**
```bash
x-wallet swap --agent-id <YOUR_AGENT_ID> --api-key <YOUR_API_KEY> --in USDC --out SOL --amount 25.0 --slippage 50
```

**JSON response (success):**
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
- `--slippage` is denominated in basis points. `50` = 0.5%. Recommended: `50`–`150`.
- Only token pairs supported by Jupiter v6 on Devnet are valid.

---

## Policy Violations — How to Handle Them

Your wallet has hardcoded spending policies. If your intent breaches these policies, the command will exit with an error code and output:

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
4. **Respect rate limits.** Exceeding 100 requests/minute to the daemon will result in temporary suspension.
