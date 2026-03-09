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

import { EventEmitter } from 'events';

// ─── Event Types ─────────────────────────────────────────────────────────────

export interface AsgardEvent {
    /** Event type identifier */
    type: string;
    /** ISO-8601 timestamp */
    timestamp: string;
    /** Event payload — shape varies by event type */
    payload: Record<string, unknown>;
}

export type AsgardEventType =
    // Agent lifecycle
    | 'agent:provisioned'
    | 'agent:listed'
    | 'agent:queried'
    // Intent execution
    | 'intent:swap:pending'
    | 'intent:swap:success'
    | 'intent:swap:failed'
    | 'intent:transfer:pending'
    | 'intent:transfer:success'
    | 'intent:transfer:failed'
    // Wallet queries
    | 'wallet:balance:queried'
    | 'wallet:history:queried'
    // Policy
    | 'policy:violation'
    // Gateway lifecycle
    | 'gateway:started'
    | 'gateway:stopped';

// ─── Singleton ───────────────────────────────────────────────────────────────

class AsgardEventBus extends EventEmitter {
    private static instance: AsgardEventBus;

    private constructor() {
        super();
        // Allow many listeners (dashboard + future integrations)
        this.setMaxListeners(50);
    }

    static getInstance(): AsgardEventBus {
        if (!AsgardEventBus.instance) {
            AsgardEventBus.instance = new AsgardEventBus();
        }
        return AsgardEventBus.instance;
    }

    /**
     * Emit a typed Asgard domain event.
     * All events are wrapped with a timestamp automatically.
     */
    emitEvent(type: AsgardEventType, payload: Record<string, unknown>): void {
        const event: AsgardEvent = {
            type,
            timestamp: new Date().toISOString(),
            payload,
        };
        this.emit('asgard:event', event);
        this.emit(type, event);
    }
}

export const eventBus = AsgardEventBus.getInstance();
