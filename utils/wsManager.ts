import { verify } from "../deps.ts";
import config from "../config/config.ts";
import { WsConnection, WsMessage } from "../types/ws.type.ts";
import { supabase } from "./db.ts";

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
    try {
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

      console.log(
        `New WebSocket connection: user ${userId}, connection ${connectionId}`
      );

      this.connections.set(connectionId, connection);

      if (!this.userConnections.has(userId)) {
        this.userConnections.set(userId, new Set());
      }
      this.userConnections.get(userId)?.add(connectionId);

      console.log(
        `Active connections: ${this.connections.size}, Users connected: ${this.userConnections.size}`
      );

      await supabase
        .from("users")
        .update({ status: "online", last_seen: new Date().toISOString() })
        .eq("id", userId);

      socket.onclose = () => {
        console.log(
          `WebSocket closed: user ${userId}, connection ${connectionId}`
        );
        this.removeConnection(connectionId);
      };

      return connection;
    } catch (error) {
      console.error("Error adding WebSocket connection:", error);
      socket.close(1011, "Server error");
      return null;
    }
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
          this.userConnections.delete(userId);
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
      console.log(
        `Connection removed. Active connections: ${this.connections.size}, Users connected: ${this.userConnections.size}`
      );
    }
  }

  async sendToUser(userId: string, message: WsMessage): Promise<void> {
    let formattedMessage;
    if (message.type === "text") {
      formattedMessage = {
        type: message.type,
        id: message.data.id,
        conversation_id: message.data.conversation_id,
        sender_id: message.data.sender_id,
        message_type: message.data.message_type,
        content: message.data.content,
        is_edited: message.data.is_edited,
        is_deleted: message.data.is_deleted,
        created_at: message.data.created_at,
        updated_at: message.data.updated_at,
        timestamp: message.timestamp,
        sender: message.sender,
      };
    } else if (message.type === "poll") {
      formattedMessage = message;
    }

    const userConns = this.userConnections.get(userId);
    if (userConns) {
      for (const connId of userConns) {
        const conn = this.connections.get(connId);
        if (conn && conn.socket.readyState === WebSocket.OPEN) {
          conn.socket.send(JSON.stringify(formattedMessage));
        }
      }
    }
  }

  async sendToConversation(
    conversationId: string,
    message: WsMessage
  ): Promise<void> {
    try {
      console.log(`Broadcasting message to conversation ${conversationId}`);
      const { data: sender, error: senderError } = await supabase
        .from("users")
        .select("id, username, avatar_url")
        .eq("id", message.sender_id)
        .single();

      if (senderError) {
        console.error(`Failed to fetch sender details: ${senderError.message}`);
        return;
      }

      const withMetadataMessage = {
        ...message,
        sender: sender,
      };

      const { data: members, error } = await supabase
        .from("conversation_members")
        .select("user_id")
        .eq("conversation_id", conversationId);

      if (error) throw new Error(error.message);

      for (const member of members) {
        const userId = member.user_id;
        if (userId !== message.sender_id) {
          try {
            this.sendToUser(userId, withMetadataMessage);
          } catch (err) {
            console.error(`Failed to send message to user ${userId}: ${err}`);
          }
        }
      }
    } catch (err) {
      console.error(`Failed to send message to conversation: ${err}`);
    }
  }

  async broadcast(message: WsMessage): Promise<void> {
    console.log(
      `Broadcasting message to all ${this.connections.size} connections`
    );
    for (const [_, connection] of this.connections) {
      if (connection.socket.readyState === WebSocket.OPEN) {
        connection.socket.send(JSON.stringify(message));
      }
    }
  }
}

export const wsManager = new WebSocketManager();
