/**
 * server.ts
 * Asgard Gateway API — Express server entry point.
 * Wires up all routes, middleware, and singleton services.
 */

import express, { Application } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import path from 'path';
import os from 'os';
import fs from 'fs';
import dotenv from 'dotenv';
import http from 'http';
import dns from 'dns';

// Fix Node 18+ undici fetch failing randomly on IPv6 resolution against Cloudflare
dns.setDefaultResultOrder('ipv4first');

// Load from ~/.asgard/.env if it exists, otherwise fallback to local .env
const asgardEnvPath = path.join(os.homedir(), '.asgard', '.env');
if (fs.existsSync(asgardEnvPath)) {
    dotenv.config({ path: asgardEnvPath });
} else {
    dotenv.config();
}

import { AsgardVault } from './vault/AsgardVault';
import { PolicyEngine } from './policy/PolicyEngine';
import { createAgentRouter } from './handlers/agentHandler';
import { createWalletRouter } from './handlers/walletHandler';
import { createIntentRouter } from './handlers/intentHandler';
import { setupSocketServer } from './socketServer';
import { eventBus } from './eventBus';

// ─── Environment Validation ──────────────────────────────────────────────────

const resolveKeystorePath = (p?: string) => {
    if (!p) return path.join(os.homedir(), '.asgard', 'keystore');
    if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
    return path.resolve(process.cwd(), p);
};

if (!process.env.ASGARD_MASTER_PASSWORD) {
    console.error(`\n❌ [FATAL] Asgard Master Password is not configured.`);
    console.error(`Please run 'asgard init' or 'npm run build && npx asgard init' from the CLI to initialize your secure local node.\n`);
    process.exit(1);
}

if (!process.env.SOLANA_RPC_URL) {
    console.error(`\n❌ [FATAL] SOLANA_RPC_URL is missing.`);
    process.exit(1);
}

// ─── Singleton Services ──────────────────────────────────────────────────────

let vault: AsgardVault;
let policy: PolicyEngine;

// ─── Express App Setup ───────────────────────────────────────────────────────

const app: Application = express();

// CORS is required because the React dashboard runs on port 5173
app.use(cors());

// Security headers (Disable strict CSP for local inline scripts)
app.use(helmet({ contentSecurityPolicy: false }));

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

app.use('/v1/agents', (req, res, next) => {
    console.log("Using agents route")
    if (!vault) {
        vault = new AsgardVault(process.env.ASGARD_MASTER_PASSWORD!, resolveKeystorePath(process.env.KEYSTORE_PATH), process.env.SOLANA_RPC_URL!);
        policy = new PolicyEngine();
    }
    createAgentRouter(vault, policy)(req, res, next);
});

app.use('/v1/wallet', (req, res, next) => {
    if (!vault) {
        vault = new AsgardVault(process.env.ASGARD_MASTER_PASSWORD!, resolveKeystorePath(process.env.KEYSTORE_PATH), process.env.SOLANA_RPC_URL!);
    }
    createWalletRouter(vault)(req, res, next);
});

app.use('/v1/intent', (req, res, next) => {
    if (!vault) {
        vault = new AsgardVault(process.env.ASGARD_MASTER_PASSWORD!, resolveKeystorePath(process.env.KEYSTORE_PATH), process.env.SOLANA_RPC_URL!);
        policy = new PolicyEngine();
    }
    createIntentRouter(vault, policy)(req, res, next);
});

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

// Serve React Webapp statically from apps/webapp/dist
const webappPath = path.resolve(__dirname, '../../webapp/dist');
if (fs.existsSync(webappPath)) {
    app.use(express.static(webappPath, { index: false }));
}

// 404 catch-all for API routes
app.use('/v1/*', (_req, res) => {
    res.status(404).json({ error: 'NotFound', message: 'API endpoint not found.' });
});

// For any other route, serve the React index.html (client-side routing fallback)
app.get('*', (req, res) => {
    const indexPath = path.join(webappPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        let html = fs.readFileSync(indexPath, 'utf-8');

        // Auto-inject the node key ONLY for local requests to prevent leaking keys
        // if the user accidentally exposes port 8017 to the public internet
        const ip = req.socket.remoteAddress;

        if (ip === '127.0.0.1' || ip === '::ffff:127.0.0.1' || ip === '::1') {
            html = html.replace(
                '</head>',
                `<script>
                    localStorage.setItem('asgard_node_key', "${process.env.ASGARD_NODE_KEY}");
                </script>
                </head>`
            );
        }
        res.send(html);

    } else {
        res.status(404).send('Asgard Webapp is not built. Run pnpm build --filter @asgard/webapp');
    }
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'InternalServerError', message: err.message });
});

// ─── Start Server ────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '8017', 10);

// Create an HTTP server so Socket.IO can share the same port
const httpServer = http.createServer(app);

// Attach Socket.IO to the HTTP server
setupSocketServer(httpServer);

httpServer.listen(PORT, () => {
    console.log(`\n🛡️  Asgard Agentic Wallet Daemon`);
    console.log(`✅  API & Dashboard listening on http://localhost:${PORT}`);
    console.log(`🌐  Solana Network: ${process.env.SOLANA_NETWORK || 'devnet'}`);
    console.log(`📁  Keystore: ${process.env.KEYSTORE_PATH || './keystore'}`);
    console.log(`🔌  Socket.IO real-time events active\n`);

    eventBus.emitEvent('gateway:started', {
        port: PORT,
        network: process.env.SOLANA_NETWORK || 'devnet',
    });
});

export default app;
