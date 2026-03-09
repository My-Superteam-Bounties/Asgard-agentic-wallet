/**
 * PolicyEngine.ts
 * The core security guardrail layer. Intercepts all Intent requests from agents
 * and enforces hardcoded spending limits, velocity checks, and program whitelists.
 *
 * The Brain (AI agent) decides WHAT to do.
 * The PolicyEngine decides IF it is PERMITTED.
 */
export type PolicyViolationCode = 'SPEND_LIMIT_EXCEEDED' | 'DAILY_TX_LIMIT_EXCEEDED' | 'VELOCITY_LIMIT_EXCEEDED' | 'PROGRAM_NOT_WHITELISTED' | 'TOKEN_NOT_ALLOWED' | 'ACTION_NOT_PERMITTED' | 'UNKNOWN_POLICY';
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
interface AgentUsage {
    dailySpendUSDC: number;
    dailyTxCount: number;
    minuteTxTimestamps: number[];
    lastResetDate: string;
}
export declare class PolicyEngine {
    private policies;
    constructor(policiesPath?: string);
    /**
     * Main entry point: evaluates an agent's intent against their policy profile.
     * Returns { allowed: true } or { allowed: false, violation: {...} }.
     */
    evaluate(agentId: string, policyProfile: string, intent: IntentRequest): PolicyCheckResult;
    /**
     * Called after a transaction is successfully broadcast.
     * Updates the in-memory usage counters.
     */
    recordUsage(agentId: string, amountUSDC: number): void;
    /**
     * Returns current usage stats for an agent (for monitoring endpoints).
     */
    getUsage(agentId: string): AgentUsage;
    private isTokenAllowed;
    private deny;
}
export {};
