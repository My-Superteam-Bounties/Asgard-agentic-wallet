"use strict";
/**
 * PolicyEngine.ts
 * The core security guardrail layer. Intercepts all Intent requests from agents
 * and enforces hardcoded spending limits, velocity checks, and program whitelists.
 *
 * The Brain (AI agent) decides WHAT to do.
 * The PolicyEngine decides IF it is PERMITTED.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PolicyEngine = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const usageStore = new Map();
/**
 * Gets today's date in UTC as YYYY-MM-DD string.
 */
function todayUTC() {
    return new Date().toISOString().split('T')[0];
}
/**
 * Returns and auto-resets the usage record for a given agent.
 */
function getAgentUsage(agentId) {
    const today = todayUTC();
    let usage = usageStore.get(agentId);
    if (!usage || usage.lastResetDate !== today) {
        // Reset daily counters at midnight UTC
        usage = {
            dailySpendUSDC: 0,
            dailyTxCount: 0,
            minuteTxTimestamps: [],
            lastResetDate: today,
        };
        usageStore.set(agentId, usage);
    }
    return usage;
}
class PolicyEngine {
    constructor(policiesPath) {
        const defaultPath = path.resolve(__dirname, '../../config/agent_policies.json');
        const configPath = policiesPath || defaultPath;
        this.policies = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
    /**
     * Main entry point: evaluates an agent's intent against their policy profile.
     * Returns { allowed: true } or { allowed: false, violation: {...} }.
     */
    evaluate(agentId, policyProfile, intent) {
        const policy = this.policies[policyProfile];
        if (!policy) {
            return {
                allowed: false,
                violation: {
                    code: 'UNKNOWN_POLICY',
                    message: `Policy profile '${policyProfile}' not found.`,
                },
            };
        }
        const usage = getAgentUsage(agentId);
        // 1. Action permission check
        if (intent.action === 'TRANSFER' && !policy.allowTransfers) {
            return this.deny('ACTION_NOT_PERMITTED', 'Transfers are not permitted for this agent.');
        }
        if (intent.action === 'SWAP' && !policy.allowSwaps) {
            return this.deny('ACTION_NOT_PERMITTED', 'Swaps are not permitted for this agent.');
        }
        // 2. Single transaction size check
        if (intent.amount > policy.maxSingleTxUSDC) {
            return this.deny('SPEND_LIMIT_EXCEEDED', `Transaction amount $${intent.amount} exceeds per-tx limit of $${policy.maxSingleTxUSDC} USDC.`);
        }
        // 3. Daily spend limit check
        const projectedDailySpend = usage.dailySpendUSDC + intent.amount;
        if (projectedDailySpend > policy.maxDailySpendUSDC) {
            const remaining = Math.max(0, policy.maxDailySpendUSDC - usage.dailySpendUSDC);
            return {
                allowed: false,
                violation: {
                    code: 'SPEND_LIMIT_EXCEEDED',
                    message: `Would exceed daily spend limit of $${policy.maxDailySpendUSDC} USDC.`,
                    dailyRemaining: remaining,
                },
            };
        }
        // 4. Daily transaction count check
        if (usage.dailyTxCount >= policy.maxTransactionsPerDay) {
            return this.deny('DAILY_TX_LIMIT_EXCEEDED', `Daily transaction limit of ${policy.maxTransactionsPerDay} reached.`);
        }
        // 5. Per-minute velocity check
        const now = Date.now();
        const oneMinuteAgo = now - 60000;
        usage.minuteTxTimestamps = usage.minuteTxTimestamps.filter((ts) => ts > oneMinuteAgo);
        if (usage.minuteTxTimestamps.length >= policy.maxTransactionsPerMinute) {
            return this.deny('VELOCITY_LIMIT_EXCEEDED', `Rate limit: max ${policy.maxTransactionsPerMinute} transactions per minute.`);
        }
        // 6. Target program whitelist check (if provided)
        if (intent.targetProgram &&
            !policy.allowedPrograms.includes(intent.targetProgram)) {
            return this.deny('PROGRAM_NOT_WHITELISTED', `Program ${intent.targetProgram} is not on the approved whitelist.`);
        }
        // 7. Token allowlist check
        const tokenToCheck = intent.token || intent.inputToken;
        if (tokenToCheck && !this.isTokenAllowed(tokenToCheck, policy)) {
            return this.deny('TOKEN_NOT_ALLOWED', `Token '${tokenToCheck}' is not on the allowed list for this agent.`);
        }
        // ✅ All checks passed — record the usage
        return { allowed: true };
    }
    /**
     * Called after a transaction is successfully broadcast.
     * Updates the in-memory usage counters.
     */
    recordUsage(agentId, amountUSDC) {
        const usage = getAgentUsage(agentId);
        usage.dailySpendUSDC += amountUSDC;
        usage.dailyTxCount += 1;
        usage.minuteTxTimestamps.push(Date.now());
    }
    /**
     * Returns current usage stats for an agent (for monitoring endpoints).
     */
    getUsage(agentId) {
        return getAgentUsage(agentId);
    }
    isTokenAllowed(ticker, policy) {
        // Allow raw mint addresses that are in the allowed list
        if (policy.allowedTokens.includes(ticker))
            return true;
        // Allow common tickers (matched by our token resolution in JupiterService)
        const knownTickers = ['SOL', 'USDC', 'wSOL', 'BONK'];
        return knownTickers.includes(ticker);
    }
    deny(code, message) {
        return { allowed: false, violation: { code, message } };
    }
}
exports.PolicyEngine = PolicyEngine;
//# sourceMappingURL=PolicyEngine.js.map