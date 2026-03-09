/**
 * agentHandler.ts
 * Routes for provisioning and managing AI agents.
 * Admin-protected: requires ASGARD_ADMIN_KEY.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AsgardVault } from '../vault/AsgardVault';
import { registerAgent, listAgents, getAgentById } from '../vault/AgentRegistry';
import { PolicyEngine } from '../policy/PolicyEngine';
import { requireAdminAuth, requireAgentAuth } from '../middleware/auth';

const VALID_PROFILES = ['default', 'read_only', 'high_volume'] as const;
type PolicyProfileName = typeof VALID_PROFILES[number];

const CreateAgentSchema = z.object({
    name: z.string().min(1).max(64),
    policyProfile: z.enum(VALID_PROFILES).default('default'),
});

export function createAgentRouter(vault: AsgardVault, policy: PolicyEngine): Router {
    const router = Router();

    /**
     * POST /v1/agents
     * Provision a new AI agent wallet.
     * Returns: agentId, walletAddress, apiKey, policyProfile
     *
     * ⚠️ Admin only. The apiKey is returned ONCE. Store it securely.
     */
    router.post('/', async (req: Request, res: Response) => {
        try {
            const parsed = CreateAgentSchema.safeParse(req.body);
            if (!parsed.success) {
                res.status(400).json({ error: 'ValidationError', details: parsed.error.issues });
                return;
            }

            const { name, policyProfile } = parsed.data;

            const agentWallet = await vault.provisionAgent(name);

            // Register in the agent registry with hashed API key
            registerAgent(
                agentWallet.agentId,
                agentWallet.name,
                agentWallet.publicKey,
                agentWallet.apiKey,
                policyProfile
            );

            res.status(201).json({
                agentId: agentWallet.agentId,
                name: agentWallet.name,
                walletAddress: agentWallet.publicKey,
                policyProfile,
                apiKey: agentWallet.apiKey, // ⚠️ Only returned once — store securely
                createdAt: agentWallet.createdAt,
                message: 'Store your apiKey securely. It cannot be retrieved again.',
            });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            res.status(500).json({ error: 'ProvisionFailed', message });
        }
    });

    /**
     * GET /v1/agents
     * Lists all registered agents — no private data is returned.
     */
    router.get('/', requireAdminAuth, (_req: Request, res: Response) => {
        try {
            // Strip apiKeyHash from all agent records before returning
            const agents = listAgents().map(({ apiKeyHash: _k, ...safe }) => safe);
            res.json({ count: agents.length, agents });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            res.status(500).json({ error: 'ListFailed', message });
        }
    });

    /**
     * GET /v1/agents/:agentId
     * Gets metadata + current usage for a specific agent.
     * Agents can only query their own record.
     */
    router.get('/:agentId', requireAgentAuth, (req: Request, res: Response) => {
        try {
            const { agentId } = req.params;

            // Agents may only query their own record
            if (req.agent?.agentId !== agentId) {
                res.status(403).json({ error: 'Forbidden', message: 'Agents can only access their own records.' });
                return;
            }

            const record = getAgentById(agentId);
            if (!record) {
                res.status(404).json({ error: 'NotFound', message: `Agent ${agentId} not found.` });
                return;
            }

            const usage = policy.getUsage(agentId);
            // Strip the apiKeyHash before returning
            const { apiKeyHash: _k, ...safeRecord } = record;

            res.json({ ...safeRecord, usage });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            res.status(500).json({ error: 'LookupFailed', message });
        }
    });

    return router;
}
