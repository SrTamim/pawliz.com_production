// Socket.IO event maps (mirrored manually in frontend/src/types).
// Receive-only client model: server pushes notifications to user:<id> rooms;
// any client "message" causes a forced disconnect (see socket.js).

export interface NotificationPayload {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: Date;
}

export interface ServerToClientEvents {
  notification: (notification: NotificationPayload) => void;
}

export interface ClientToServerEvents {
  message: (...args: unknown[]) => void;
}

export interface InterServerEvents {}

export interface SocketData {
  userId: number;
}
