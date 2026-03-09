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
export interface AsgardEvent {
    /** Event type identifier */
    type: string;
    /** ISO-8601 timestamp */
    timestamp: string;
    /** Event payload — shape varies by event type */
    payload: Record<string, unknown>;
}
export type AsgardEventType = 'agent:provisioned' | 'agent:listed' | 'agent:queried' | 'intent:swap:pending' | 'intent:swap:success' | 'intent:swap:failed' | 'intent:transfer:pending' | 'intent:transfer:success' | 'intent:transfer:failed' | 'wallet:balance:queried' | 'wallet:history:queried' | 'policy:violation' | 'gateway:started' | 'gateway:stopped';
declare class AsgardEventBus extends EventEmitter {
    private static instance;
    private constructor();
    static getInstance(): AsgardEventBus;
    /**
     * Emit a typed Asgard domain event.
     * All events are wrapped with a timestamp automatically.
     */
    emitEvent(type: AsgardEventType, payload: Record<string, unknown>): void;
}
export declare const eventBus: AsgardEventBus;
export {};
