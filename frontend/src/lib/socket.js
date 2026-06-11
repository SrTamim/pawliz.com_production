import { io } from "socket.io-client";

const API_SERVER_BASE =
  (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace(
    "/api",
    "",
  );

// Module-level singleton — one socket per browser session
let _socket = null;

/**
 * Get or create the shared Socket.IO instance.
 * Reconnects if previously disconnected.
 */
export function getSocket() {
  if (!_socket || _socket.disconnected) {
    _socket = io(API_SERVER_BASE, {
      withCredentials: true,
      transports: ["websocket"],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 30000,
    });
  }
  return _socket;
}

/**
 * Disconnect and destroy the shared socket.
 * Call on logout to prevent stale connections carrying over to the next user session.
 */
export function disconnectSocket() {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
}