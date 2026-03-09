"use strict";
/**
 * auth.ts
 * Express middleware for validating Asgard API Keys and IP allowlists.
 * Attaches the authenticated AgentRecord to the request for downstream handlers.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAgentAuth = requireAgentAuth;
exports.requireNodeAuth = requireNodeAuth;
const AgentRegistry_1 = require("../vault/AgentRegistry");
/**
 * Extracts the Bearer token from the Authorization header.
 */
function extractBearerToken(req) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer '))
        return null;
    return authHeader.substring(7);
}
/**
 * Main authentication middleware.
 * Validates the API key and resolves the associated agent.
 */
function requireAgentAuth(req, res, next) {
    const apiKey = extractBearerToken(req);
    if (!apiKey) {
        res.status(401).json({
            error: 'Unauthorized',
            message: 'Missing Authorization: Bearer <API_KEY> header.',
        });
        return;
    }
    const agent = (0, AgentRegistry_1.findAgentByApiKey)(apiKey);
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
function requireNodeAuth(req, res, next) {
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
//# sourceMappingURL=auth.js.map