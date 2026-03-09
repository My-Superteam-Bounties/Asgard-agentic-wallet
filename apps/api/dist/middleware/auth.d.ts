/**
 * auth.ts
 * Express middleware for validating Asgard API Keys and IP allowlists.
 * Attaches the authenticated AgentRecord to the request for downstream handlers.
 */
import { Request, Response, NextFunction } from 'express';
import { AgentRecord } from '../vault/AgentRegistry';
declare global {
    namespace Express {
        interface Request {
            agent?: AgentRecord;
        }
    }
}
/**
 * Main authentication middleware.
 * Validates the API key and resolves the associated agent.
 */
export declare function requireAgentAuth(req: Request, res: Response, next: NextFunction): void;
/**
 * Node-level authentication middleware.
 * Validates the Asgard Node Key for agent provisioning endpoints.
 */
export declare function requireNodeAuth(req: Request, res: Response, next: NextFunction): void;
