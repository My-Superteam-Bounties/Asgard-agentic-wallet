"use strict";
/**
 * agentHandler.ts
 * Routes for provisioning and managing AI agents.
 * Admin-protected: requires ASGARD_ADMIN_KEY.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAgentRouter = createAgentRouter;
const express_1 = require("express");
const zod_1 = require("zod");
const AgentRegistry_1 = require("../vault/AgentRegistry");
const auth_1 = require("../middleware/auth");
const eventBus_1 = require("../eventBus");
const VALID_PROFILES = ['default', 'read_only', 'high_volume'];
const CreateAgentSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(64),
    policyProfile: zod_1.z.enum(VALID_PROFILES).default('default'),
});
function createAgentRouter(vault, policy) {
    const router = (0, express_1.Router)();
    /**
     * POST /v1/agents
     * Provision a new AI agent wallet.
     * Returns: agentId, walletAddress, apiKey, policyProfile
     *
     * ⚠️ Requires Node Key. The apiKey is returned ONCE. Store it securely.
     */
    router.post('/', auth_1.requireNodeAuth, async (req, res) => {
        try {
            const parsed = CreateAgentSchema.safeParse(req.body);
            if (!parsed.success) {
                res.status(400).json({ error: 'ValidationError', details: parsed.error.issues });
                return;
            }
            const { name, policyProfile } = parsed.data;
            const agentWallet = await vault.provisionAgent(name);
            // Register in the agent registry with hashed API key
            (0, AgentRegistry_1.registerAgent)(agentWallet.agentId, agentWallet.name, agentWallet.publicKey, agentWallet.apiKey, policyProfile);
            res.status(201).json({
                agentId: agentWallet.agentId,
                name: agentWallet.name,
                walletAddress: agentWallet.publicKey,
                policyProfile,
                apiKey: agentWallet.apiKey, // ⚠️ Only returned once — store securely
                createdAt: agentWallet.createdAt,
                message: 'Store your apiKey securely. It cannot be retrieved again.',
            });
            // Emit real-time event
            eventBus_1.eventBus.emitEvent('agent:provisioned', {
                agentId: agentWallet.agentId,
                name: agentWallet.name,
                walletAddress: agentWallet.publicKey,
                policyProfile,
            });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            res.status(500).json({ error: 'ProvisionFailed', message });
        }
    });
    /**
     * GET /v1/agents
     * Lists all registered agents — no private data is returned.
     */
    router.get('/', auth_1.requireNodeAuth, (_req, res) => {
        try {
            // Strip apiKeyHash from all agent records before returning
            const agents = (0, AgentRegistry_1.listAgents)().map(({ apiKeyHash: _k, ...safe }) => safe);
            res.json({ count: agents.length, agents });
            eventBus_1.eventBus.emitEvent('agent:listed', {
                count: agents.length,
            });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            res.status(500).json({ error: 'ListFailed', message });
        }
    });
    /**
     * GET /v1/agents/:agentId
     * Gets metadata + current usage for a specific agent.
     * Agents can only query their own record.
     */
    router.get('/:agentId', auth_1.requireAgentAuth, (req, res) => {
        try {
            const { agentId } = req.params;
            // Agents may only query their own record
            if (req.agent?.agentId !== agentId) {
                res.status(403).json({ error: 'Forbidden', message: 'Agents can only access their own records.' });
                return;
            }
            const record = (0, AgentRegistry_1.getAgentById)(agentId);
            if (!record) {
                res.status(404).json({ error: 'NotFound', message: `Agent ${agentId} not found.` });
                return;
            }
            const usage = policy.getUsage(agentId);
            // Strip the apiKeyHash before returning
            const { apiKeyHash: _k, ...safeRecord } = record;
            res.json({ ...safeRecord, usage });
            eventBus_1.eventBus.emitEvent('agent:queried', {
                agentId,
                name: record.name,
            });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            res.status(500).json({ error: 'LookupFailed', message });
        }
    });
    return router;
}
//# sourceMappingURL=agentHandler.js.map