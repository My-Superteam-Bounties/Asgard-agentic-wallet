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
import { Server as SocketIOServer } from 'socket.io';
/**
 * Initialize the Socket.IO server and wire it to the EventBus.
 * Call this once after creating the HTTP server.
 */
export declare function setupSocketServer(httpServer: HttpServer): SocketIOServer;
/**
 * Get the active Socket.IO server instance.
 * Returns null if not yet initialized.
 */
export declare function getSocketServer(): SocketIOServer | null;
