import { verify } from "../deps";
import config from "../config/config";
import { WsConnection, WsMessage } from "../types/ws.type";
import { supabase } from "./db";

class WebSocketManager {
  private connections: Map<string, WsConnection> = new Map();
  private userConnections: Map<string, Set<string>> = new Map();

  constructor() {
    console.log("WebSocket Manager initialized");
  }

  async validateToken(token: string): Promise<{ userId: string } | null> {
    try {
      const encoder = new TextEncoder();
      const keyData = encoder.encode(config.supabase.jwtSecret);
      const key = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
      );

      const payload = await verify(token, key);
      return { userId: payload.sub as string };
    } catch (error) {
      console.error("Token validation error:", error);
      return null;
    }
  }

  async addConnection(
    socket: WebSocket,
    token: string
  ): Promise<WsConnection | null> {
    const validationResult = await this.validateToken(token);
    if (!validationResult) {
      socket.close(1008, "Invalid token");
      return null;
    }

    const { userId } = validationResult;
    const connectionId = crypto.randomUUID();

    const connection: WsConnection = {
      id: connectionId,
      userId,
      socket,
    };

    this.connections.set(connectionId, connection);

    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId)?.add(connectionId);

    await supabase
      .from("users")
      .update({ status: "online", last_seen: new Date().toISOString() })
      .eq("id", userId);

    socket.onclose = () => this.removeConnection(connectionId);

    return connection;
  }

  removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      const { userId } = connection;

      this.connections.delete(connectionId);

      const userConns = this.userConnections.get(userId);
      if (userConns) {
        userConns.delete(connectionId);

        if (userConns.size === 0) {
          supabase
            .from("users")
            .update({ status: "offline", last_seen: new Date().toISOString() })
            .eq("id", userId)
            .then(() => console.log(`User ${userId} marked offline`))
            .catch((err) =>
              console.error(`Failed to update user status: ${err}`)
            );
        }
      }
    }
  }

  sendToUser(userId: string, message: WsMessage): void {
    const userConns = this.userConnections.get(userId);
    if (userConns) {
      for (const connId of userConns) {
        const conn = this.connections.get(connId);
        if (conn && conn.socket.readyState === WebSocket.OPEN) {
          conn.socket.send(JSON.stringify(message));
        }
      }
    }
  }

  async sendToConversation(
    conversationId: string,
    message: WsMessage
  ): Promise<void> {
    try {
      const { data: members, error } = await supabase
        .from("conversation_members")
        .select("user_id")
        .eq("conversation_id", conversationId);

      if (error) throw new Error(error.message);

      for (const member of members) {
        const userId = member.user_id;
        if (userId !== message.sender_id) {
          this.sendToUser(userId, message);
        }
      }
    } catch (err) {
      console.error(`Failed to send message to conversation: ${err}`);
    }
  }

  broadcast(message: WsMessage): void {
    for (const [_, connection] of this.connections) {
      if (connection.socket.readyState === WebSocket.OPEN) {
        connection.socket.send(JSON.stringify(message));
      }
    }
  }
}

export const wsManager = new WebSocketManager();
