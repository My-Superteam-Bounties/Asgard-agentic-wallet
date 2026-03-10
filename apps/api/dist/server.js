"use strict";
/**
 * server.ts
 * Asgard Gateway API — Express server entry point.
 * Wires up all routes, middleware, and singleton services.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const fs_1 = __importDefault(require("fs"));
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = __importDefault(require("http"));
// Load from ~/.asgard/.env if it exists, otherwise fallback to local .env
const asgardEnvPath = path_1.default.join(os_1.default.homedir(), '.asgard', '.env');
if (fs_1.default.existsSync(asgardEnvPath)) {
    dotenv_1.default.config({ path: asgardEnvPath });
}
else {
    dotenv_1.default.config();
}
const AsgardVault_1 = require("./vault/AsgardVault");
const PolicyEngine_1 = require("./policy/PolicyEngine");
const agentHandler_1 = require("./handlers/agentHandler");
const walletHandler_1 = require("./handlers/walletHandler");
const intentHandler_1 = require("./handlers/intentHandler");
const socketServer_1 = require("./socketServer");
const eventBus_1 = require("./eventBus");
// ─── Environment Validation ──────────────────────────────────────────────────
const resolveKeystorePath = (p) => {
    if (!p)
        return path_1.default.join(os_1.default.homedir(), '.asgard', 'keystore');
    if (p.startsWith('~/'))
        return path_1.default.join(os_1.default.homedir(), p.slice(2));
    return path_1.default.resolve(process.cwd(), p);
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
let vault;
let policy;
// ─── Express App Setup ───────────────────────────────────────────────────────
const app = (0, express_1.default)();
// CORS is required because the React dashboard runs on port 5173
app.use((0, cors_1.default)());
// Security headers
app.use((0, helmet_1.default)());
// Request logging
app.use((0, morgan_1.default)('combined'));
// JSON body parsing
app.use(express_1.default.json());
// Global rate limiter (100 req/min per IP)
app.use((0, express_rate_limit_1.default)({
    windowMs: 60000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'TooManyRequests', message: 'Rate limit exceeded. Max 100 requests/minute.' },
}));
// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/v1/agents', (req, res, next) => {
    if (!vault) {
        vault = new AsgardVault_1.AsgardVault(process.env.ASGARD_MASTER_PASSWORD, resolveKeystorePath(process.env.KEYSTORE_PATH), process.env.SOLANA_RPC_URL);
        policy = new PolicyEngine_1.PolicyEngine();
    }
    (0, agentHandler_1.createAgentRouter)(vault, policy)(req, res, next);
});
app.use('/v1/wallet', (req, res, next) => {
    if (!vault) {
        vault = new AsgardVault_1.AsgardVault(process.env.ASGARD_MASTER_PASSWORD, resolveKeystorePath(process.env.KEYSTORE_PATH), process.env.SOLANA_RPC_URL);
    }
    (0, walletHandler_1.createWalletRouter)(vault)(req, res, next);
});
app.use('/v1/intent', (req, res, next) => {
    if (!vault) {
        vault = new AsgardVault_1.AsgardVault(process.env.ASGARD_MASTER_PASSWORD, resolveKeystorePath(process.env.KEYSTORE_PATH), process.env.SOLANA_RPC_URL);
        policy = new PolicyEngine_1.PolicyEngine();
    }
    (0, intentHandler_1.createIntentRouter)(vault, policy)(req, res, next);
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
const webappPath = path_1.default.resolve(__dirname, '../../webapp/dist');
if (fs_1.default.existsSync(webappPath)) {
    app.use(express_1.default.static(webappPath));
}
// 404 catch-all for API routes
app.use('/v1/*', (_req, res) => {
    res.status(404).json({ error: 'NotFound', message: 'API endpoint not found.' });
});
// For any other route, serve the React index.html (client-side routing fallback)
app.get('*', (req, res) => {
    const indexPath = path_1.default.join(webappPath, 'index.html');
    if (fs_1.default.existsSync(indexPath)) {
        let html = fs_1.default.readFileSync(indexPath, 'utf-8');
        // Auto-inject the node key ONLY for local requests to prevent leaking keys
        // if the user accidentally exposes port 8017 to the public internet
        const ip = req.socket.remoteAddress;
        if (ip === '127.0.0.1' || ip === '::ffff:127.0.0.1' || ip === '::1') {
            html = html.replace('</head>', `<script>window.ASGARD_NODE_KEY="${process.env.ASGARD_NODE_KEY}";</script></head>`);
        }
        res.send(html);
    }
    else {
        res.status(404).send('Asgard Webapp is not built. Run npm run build -w apps/webapp');
    }
});
// Global error handler
app.use((err, _req, res, _next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'InternalServerError', message: err.message });
});
// ─── Start Server ────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '8017', 10);
// Create an HTTP server so Socket.IO can share the same port
const httpServer = http_1.default.createServer(app);
// Attach Socket.IO to the HTTP server
(0, socketServer_1.setupSocketServer)(httpServer);
httpServer.listen(PORT, () => {
    console.log(`\n🛡️  Asgard Agentic Wallet Daemon`);
    console.log(`✅  API & Dashboard listening on http://localhost:${PORT}`);
    console.log(`🌐  Solana Network: ${process.env.SOLANA_NETWORK || 'devnet'}`);
    console.log(`📁  Keystore: ${process.env.KEYSTORE_PATH || './keystore'}`);
    console.log(`🔌  Socket.IO real-time events active\n`);
    eventBus_1.eventBus.emitEvent('gateway:started', {
        port: PORT,
        network: process.env.SOLANA_NETWORK || 'devnet',
    });
});
exports.default = app;
//# sourceMappingURL=server.js.map