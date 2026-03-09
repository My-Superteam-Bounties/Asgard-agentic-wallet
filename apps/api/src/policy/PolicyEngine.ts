/**
 * PolicyEngine.ts
 * The core security guardrail layer. Intercepts all Intent requests from agents
 * and enforces hardcoded spending limits, velocity checks, and program whitelists.
 *
 * The Brain (AI agent) decides WHAT to do.
 * The PolicyEngine decides IF it is PERMITTED.
 */

import * as fs from 'fs';
import * as path from 'path';

interface PolicyProfile {
    description: string;
    maxDailySpendUSDC: number;
    maxSingleTxUSDC: number;
    maxTransactionsPerMinute: number;
    maxTransactionsPerDay: number;
    allowedPrograms: string[];
    allowedTokens: string[];
    allowTransfers: boolean;
    allowSwaps: boolean;
}

interface PolicyConfig {
    [key: string]: PolicyProfile;
}

export type PolicyViolationCode =
    | 'SPEND_LIMIT_EXCEEDED'
    | 'DAILY_TX_LIMIT_EXCEEDED'
    | 'VELOCITY_LIMIT_EXCEEDED'
    | 'PROGRAM_NOT_WHITELISTED'
    | 'TOKEN_NOT_ALLOWED'
    | 'ACTION_NOT_PERMITTED'
    | 'UNKNOWN_POLICY';

export interface PolicyViolation {
    code: PolicyViolationCode;
    message: string;
    dailyRemaining?: number;
}

export interface PolicyCheckResult {
    allowed: boolean;
    violation?: PolicyViolation;
}

export interface IntentRequest {
    action: 'TRANSFER' | 'SWAP';
    token?: string;
    inputToken?: string;
    outputToken?: string;
    amount: number;
    destination?: string;
    targetProgram?: string;
}

// In-memory usage tracking per agent (resets on server restart)
// In production, this would be backed by Redis for multi-instance support
interface AgentUsage {
    dailySpendUSDC: number;
    dailyTxCount: number;
    minuteTxTimestamps: number[];
    lastResetDate: string; // ISO date string YYYY-MM-DD
}

const usageStore = new Map<string, AgentUsage>();

/**
 * Gets today's date in UTC as YYYY-MM-DD string.
 */
function todayUTC(): string {
    return new Date().toISOString().split('T')[0];
}

/**
 * Returns and auto-resets the usage record for a given agent.
 */
function getAgentUsage(agentId: string): AgentUsage {
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

export class PolicyEngine {
    private policies: PolicyConfig;

    constructor(policiesPath?: string) {
        const defaultPath = path.resolve(
            __dirname,
            '../../config/agent_policies.json'
        );
        const configPath = policiesPath || defaultPath;
        this.policies = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as PolicyConfig;
    }

    /**
     * Main entry point: evaluates an agent's intent against their policy profile.
     * Returns { allowed: true } or { allowed: false, violation: {...} }.
     */
    evaluate(
        agentId: string,
        policyProfile: string,
        intent: IntentRequest
    ): PolicyCheckResult {
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
            return this.deny(
                'SPEND_LIMIT_EXCEEDED',
                `Transaction amount $${intent.amount} exceeds per-tx limit of $${policy.maxSingleTxUSDC} USDC.`
            );
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
            return this.deny(
                'DAILY_TX_LIMIT_EXCEEDED',
                `Daily transaction limit of ${policy.maxTransactionsPerDay} reached.`
            );
        }

        // 5. Per-minute velocity check
        const now = Date.now();
        const oneMinuteAgo = now - 60_000;
        usage.minuteTxTimestamps = usage.minuteTxTimestamps.filter(
            (ts) => ts > oneMinuteAgo
        );
        if (usage.minuteTxTimestamps.length >= policy.maxTransactionsPerMinute) {
            return this.deny(
                'VELOCITY_LIMIT_EXCEEDED',
                `Rate limit: max ${policy.maxTransactionsPerMinute} transactions per minute.`
            );
        }

        // 6. Target program whitelist check (if provided)
        if (
            intent.targetProgram &&
            !policy.allowedPrograms.includes(intent.targetProgram)
        ) {
            return this.deny(
                'PROGRAM_NOT_WHITELISTED',
                `Program ${intent.targetProgram} is not on the approved whitelist.`
            );
        }

        // 7. Token allowlist check
        const tokenToCheck = intent.token || intent.inputToken;
        if (tokenToCheck && !this.isTokenAllowed(tokenToCheck, policy)) {
            return this.deny(
                'TOKEN_NOT_ALLOWED',
                `Token '${tokenToCheck}' is not on the allowed list for this agent.`
            );
        }

        // ✅ All checks passed — record the usage
        return { allowed: true };
    }

    /**
     * Called after a transaction is successfully broadcast.
     * Updates the in-memory usage counters.
     */
    recordUsage(agentId: string, amountUSDC: number): void {
        const usage = getAgentUsage(agentId);
        usage.dailySpendUSDC += amountUSDC;
        usage.dailyTxCount += 1;
        usage.minuteTxTimestamps.push(Date.now());
    }

    /**
     * Returns current usage stats for an agent (for monitoring endpoints).
     */
    getUsage(agentId: string): AgentUsage {
        return getAgentUsage(agentId);
    }

    private isTokenAllowed(ticker: string, policy: PolicyProfile): boolean {
        // Allow raw mint addresses that are in the allowed list
        if (policy.allowedTokens.includes(ticker)) return true;
        // Allow common tickers (matched by our token resolution in JupiterService)
        const knownTickers = ['SOL', 'USDC', 'wSOL', 'BONK'];
        return knownTickers.includes(ticker);
    }

    private deny(code: PolicyViolationCode, message: string): PolicyCheckResult {
        return { allowed: false, violation: { code, message } };
    }
}
