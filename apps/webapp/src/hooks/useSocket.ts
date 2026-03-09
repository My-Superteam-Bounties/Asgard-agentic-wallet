/**
 * useSocket.ts
 * React hook for real-time Socket.IO event streaming from the Asgard daemon.
 * 
 * Connects to the daemon on mount, auto-reconnects on disconnect,
 * and exposes a live event stream for the ActivityFeed component.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface AsgardEvent {
    type: string;
    timestamp: string;
    payload: Record<string, unknown>;
}

const MAX_EVENTS = 100; // Keep the last 100 events in memory

/**
 * Resolves the Socket.IO server URL.
 * In production (statically served by the daemon), use '' (same origin).
 * In dev mode, use the explicit daemon URL.
 */
function getSocketUrl(): string {
    const stored = localStorage.getItem('asgard_url');
    if (stored) return stored;

    // Vite injects import.meta.env at build time
    if (typeof import.meta !== 'undefined' && import.meta.env?.PROD) {
        return ''; // same origin
    }
    return import.meta.env?.VITE_API_URL || 'http://localhost:8017';
}

export function useSocket() {
    const socketRef = useRef<Socket | null>(null);
    const [connected, setConnected] = useState(false);
    const [events, setEvents] = useState<AsgardEvent[]>([]);

    const addEvent = useCallback((event: AsgardEvent) => {
        setEvents((prev) => {
            const next = [event, ...prev];
            // Cap at MAX_EVENTS to avoid unbounded memory usage
            return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next;
        });
    }, []);

    const clearEvents = useCallback(() => {
        setEvents([]);
    }, []);

    useEffect(() => {
        const url = getSocketUrl();
        const socket = io(url, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 2000,
            reconnectionDelayMax: 10000,
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            setConnected(true);
        });

        socket.on('disconnect', () => {
            setConnected(false);
        });

        socket.on('asgard:event', (event: AsgardEvent) => {
            addEvent(event);
        });

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, [addEvent]);

    return { connected, events, clearEvents };
}
