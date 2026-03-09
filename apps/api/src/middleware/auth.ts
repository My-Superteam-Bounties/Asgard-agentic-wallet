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
 * Admin-only authentication middleware.
 * Validates the Asgard Admin Key for agent provisioning endpoints.
 */
export function requireAdminAuth(
    req: Request,
    res: Response,
    next: NextFunction
): void {
    const apiKey = extractBearerToken(req);
    const adminKey = process.env.ASGARD_ADMIN_KEY;

    if (!adminKey) {
        res.status(500).json({ error: 'Server misconfiguration: ASGARD_ADMIN_KEY not set.' });
        return;
    }

    if (!apiKey || apiKey !== adminKey) {
        res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid admin key.',
        });
        return;
    }

    next();
}
