/**
 * server.ts
 * Asgard Gateway API — Express server entry point.
 * Wires up all routes, middleware, and singleton services.
 */

import 'dotenv/config';
import express, { Application } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import path from 'path';

import { AsgardVault } from './vault/AsgardVault';
import { PolicyEngine } from './policy/PolicyEngine';
import { createAgentRouter } from './handlers/agentHandler';
import { createWalletRouter } from './handlers/walletHandler';
import { createIntentRouter } from './handlers/intentHandler';

// ─── Environment Validation ──────────────────────────────────────────────────

const REQUIRED_ENV = ['ASGARD_MASTER_PASSWORD', 'SOLANA_RPC_URL', 'ASGARD_ADMIN_KEY'];
for (const key of REQUIRED_ENV) {
    if (!process.env[key]) {
        console.error(`❌ Missing required environment variable: ${key}`);
        console.error('   Copy .env.example to .env and fill in all values.');
        process.exit(1);
    }
}

// ─── Singleton Services ──────────────────────────────────────────────────────

const vault = new AsgardVault(
    process.env.ASGARD_MASTER_PASSWORD!,
    process.env.KEYSTORE_PATH || path.resolve(process.cwd(), 'keystore'),
    process.env.SOLANA_RPC_URL!
);

const policy = new PolicyEngine();

// ─── Express App Setup ───────────────────────────────────────────────────────

const app: Application = express();

// CORS is required because the React dashboard runs on port 5173
app.use(cors());

// Security headers
app.use(helmet());

// Request logging
app.use(morgan('combined'));

// JSON body parsing
app.use(express.json());

// Global rate limiter (100 req/min per IP)
app.use(
    rateLimit({
        windowMs: 60_000,
        max: 100,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'TooManyRequests', message: 'Rate limit exceeded. Max 100 requests/minute.' },
    })
);

// ─── Routes ──────────────────────────────────────────────────────────────────

app.use('/v1/agents', createAgentRouter(vault, policy));
app.use('/v1/wallet', createWalletRouter(vault));
app.use('/v1/intent', createIntentRouter(vault, policy));

// Health check
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        service: 'Asgard Agentic Wallet Gateway',
        version: '1.0.0',
        network: process.env.SOLANA_NETWORK || 'devnet',
        timestamp: new Date().toISOString(),
    });
});

// 404 catch-all
app.use((_req, res) => {
    res.status(404).json({ error: 'NotFound', message: 'Endpoint not found.' });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'InternalServerError', message: err.message });
});

// ─── Start Server ────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '3000', 10);
app.listen(PORT, () => {
    console.log(`\n🛡️  Asgard Agentic Wallet Gateway`);
    console.log(`✅  Server listening on http://localhost:${PORT}`);
    console.log(`🌐  Solana Network: ${process.env.SOLANA_NETWORK || 'devnet'}`);
    console.log(`📁  Keystore: ${process.env.KEYSTORE_PATH || './keystore'}\n`);
});

export default app;
