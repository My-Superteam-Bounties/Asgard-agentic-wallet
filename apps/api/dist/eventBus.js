"use strict";
/**
 * eventBus.ts
 * Centralized event emitter for the Asgard daemon.
 *
 * All handlers emit domain events through this singleton.
 * The Socket.IO server subscribes to these events and broadcasts
 * them to connected dashboard clients in real time.
 *
 * Event Naming Convention:  domain:action  (e.g. "agent:provisioned", "intent:swap:success")
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventBus = void 0;
const events_1 = require("events");
// ─── Singleton ───────────────────────────────────────────────────────────────
class AsgardEventBus extends events_1.EventEmitter {
    constructor() {
        super();
        // Allow many listeners (dashboard + future integrations)
        this.setMaxListeners(50);
    }
    static getInstance() {
        if (!AsgardEventBus.instance) {
            AsgardEventBus.instance = new AsgardEventBus();
        }
        return AsgardEventBus.instance;
    }
    /**
     * Emit a typed Asgard domain event.
     * All events are wrapped with a timestamp automatically.
     */
    emitEvent(type, payload) {
        const event = {
            type,
            timestamp: new Date().toISOString(),
            payload,
        };
        this.emit('asgard:event', event);
        this.emit(type, event);
    }
}
exports.eventBus = AsgardEventBus.getInstance();
//# sourceMappingURL=eventBus.js.map