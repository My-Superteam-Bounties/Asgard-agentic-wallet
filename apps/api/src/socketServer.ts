/**
 * socketServer.ts
 * Socket.IO server for real-time event streaming to the dashboard.
 * 
 * Attaches to the existing HTTP server and subscribes to the
 * centralized EventBus. All domain events are broadcast to
 * connected clients on the 'asgard:event' channel.
 * 
 * Clients can also subscribe to specific event types for filtering.
 */

import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { eventBus, AsgardEvent } from './eventBus';

let io: SocketIOServer | null = null;

/**
 * Initialize the Socket.IO server and wire it to the EventBus.
 * Call this once after creating the HTTP server.
 */
export function setupSocketServer(httpServer: HttpServer): SocketIOServer {
    io = new SocketIOServer(httpServer, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST'],
        },
        // Use WebSocket transport first, fall back to polling
        transports: ['websocket', 'polling'],
    });

    // ─── Connection Handling ─────────────────────────────────────────────────

    io.on('connection', (socket: Socket) => {
        console.log(`🔌 Dashboard client connected: ${socket.id}`);

        // Send a welcome event so the client knows the connection is live
        socket.emit('asgard:event', {
            type: 'gateway:connected',
            timestamp: new Date().toISOString(),
            payload: { message: 'Connected to Asgard event stream' },
        });

        // Allow clients to subscribe to specific event types
        socket.on('subscribe', (eventType: string) => {
            socket.join(eventType);
            console.log(`📡 Client ${socket.id} subscribed to: ${eventType}`);
        });

        socket.on('unsubscribe', (eventType: string) => {
            socket.leave(eventType);
        });

        socket.on('disconnect', (reason: string) => {
            console.log(`🔌 Dashboard client disconnected: ${socket.id} (${reason})`);
        });
    });

    // ─── EventBus → Socket.IO Bridge ─────────────────────────────────────────

    eventBus.on('asgard:event', (event: AsgardEvent) => {
        if (!io) return;

        // Broadcast to ALL connected clients on the global channel
        io.emit('asgard:event', event);

        // Also emit to the room matching the event type (for filtered subscriptions)
        io.to(event.type).emit(event.type, event);
    });

    console.log('🔌 Socket.IO server initialized');
    return io;
}

/**
 * Get the active Socket.IO server instance.
 * Returns null if not yet initialized.
 */
export function getSocketServer(): SocketIOServer | null {
    return io;
}
