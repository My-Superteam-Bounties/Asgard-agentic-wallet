/**
 * auth.ts
 * Express middleware for validating Asgard API Keys and IP allowlists.
 * Attaches the authenticated AgentRecord to the request for downstream handlers.
 */

import { Request, Response, NextFunction } from 'express';
import { findAgentByApiKey, AgentRecord } from '../vault/AgentRegistry';

// Extend Express Request to carry the authenticated agent
declare global {
    namespace Express {
        interface Request {
            agent?: AgentRecord;
        }
    }
}

/**
 * Extracts the Bearer token from the Authorization header.
 */
function extractBearerToken(req: Request): string | null {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    return authHeader.substring(7);
}

/**
 * Main authentication middleware.
 * Validates the API key and resolves the associated agent.
 */
export function requireAgentAuth(
    req: Request,
    res: Response,
    next: NextFunction
): void {
    const apiKey = extractBearerToken(req);

    if (!apiKey) {
        res.status(401).json({
            error: 'Unauthorized',
            message: 'Missing Authorization: Bearer <API_KEY> header.',
        });
        return;
    }

    console.log("Fetching agent id")
    console.log(apiKey)

    const agent = findAgentByApiKey(apiKey);

    if (!agent) {
        res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid or expired API key.',
        });
        return;
    }

    // Attach the resolved agent to the request for downstream handlers
    req.agent = agent;
    next();
}

/**
 * Node-level authentication middleware.
 * Validates the Asgard Node Key for agent provisioning endpoints.
 */
export function requireNodeAuth(
    req: Request,
    res: Response,
    next: NextFunction
): void {
    const apiKey = extractBearerToken(req);
    const nodeKey = process.env.ASGARD_NODE_KEY;

    if (!nodeKey) {
        res.status(500).json({ error: 'Server misconfiguration: ASGARD_NODE_KEY not set. Run `asgard init`.' });
        return;
    }

    if (!apiKey || apiKey !== nodeKey) {
        res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid node key.',
        });
        return;
    }

    next();
}

/**
 * Dual authentication middleware.
 * Allows either the Node Key (Admin) or the Agent API Key.
 */
export function requireNodeOrAgentAuth(
    req: Request,
    res: Response,
    next: NextFunction
): void {
    const apiKey = extractBearerToken(req);
    const nodeKey = process.env.ASGARD_NODE_KEY;

    if (!apiKey) {
        res.status(401).json({ error: 'Unauthorized', message: 'Missing Authorization header.' });
        return;
    }

    // 1. Try Node Auth (Admin)
    if (nodeKey && apiKey === nodeKey) {
        // We are admin, proceed
        next();
        return;
    }

    // 2. Try Agent Auth
    const agent = findAgentByApiKey(apiKey);
    if (!agent) {
        res.status(401).json({ error: 'Unauthorized', message: 'Invalid API key.' });
        return;
    }

    req.agent = agent;
    next();
}
