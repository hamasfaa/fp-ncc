import { Context } from "../deps.ts";
import { sendChatMessage, markAsRead } from "../services/chat.service.ts";
import { MessageType } from "../types/ws.type.ts";
import { supabase } from "../utils/db.ts";
import { wsManager } from "../utils/wsManager.ts";
import { submitPollVote } from "../services/poll.service.ts";

export async function handleWebSocket(ctx: Context) {
  try {
    const token = ctx.request.url.searchParams.get("token");

    if (!token) {
      ctx.response.status = 401;
      ctx.response.body = { error: "No token provided" };
      return;
    }

    if (!ctx.isUpgradable) {
      ctx.response.status = 400;
      ctx.response.body = {
        error: "Connection is not upgradable to WebSocket",
      };
      return;
    }

    const socket = ctx.upgrade();

    const connection = await wsManager.addConnection(socket, token);
    if (!connection) {
      return;
    }

    socket.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case MessageType.TEXT:
            await handleTextMessage(connection.userId, message);
            break;
          case MessageType.READ_RECEIPT:
            await handleReadReceipt(connection.userId, message);
            break;
          case MessageType.USER_STATUS:
            await handleStatusUpdate(connection.userId, message);
            break;
          case MessageType.POLL:
            await handlePollMessage(connection.userId, message);
            break;
          default:
            console.warn("Unknown message type:", message.type);
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
        socket.send(
          JSON.stringify({
            type: "error",
            message: "Invalid message format",
          })
        );
      }
    };

    socket.onerror = (event) => {
      console.error("WebSocket error:", event);
    };

    socket.send(
      JSON.stringify({
        type: "connection",
        status: "connected",
        userId: connection.userId,
        timestamp: Date.now(),
      })
    );
  } catch (error) {
    console.error("WebSocket connection error:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to establish WebSocket connection" };
  }
}

async function handleTextMessage(userId: string, message: any) {
  if (!message.conversation_id || !message.data?.content) {
    return;
  }

  await sendChatMessage(userId, message.conversation_id, message.data.content);
}

async function handleReadReceipt(userId: string, message: any) {
  if (!message.data?.message_id) {
    return;
  }

  await markAsRead(userId, message.data.message_id);
}

async function handleStatusUpdate(userId: string, message: any) {
  if (!message.data?.status) {
    return;
  }

  await supabase
    .from("users")
    .update({
      status: message.data.status,
      last_seen: new Date().toISOString(),
    })
    .eq("id", userId);
}
async function handlePollMessage(userId: string, message: any) {
  if (!message.data?.poll_id || !message.data?.option_id) {
    return;
  }

  try {
    await submitPollVote(
      userId,
      message.conversation_id,
      message.data.poll_id,
      message.data.option_id,
      message.data.is_multiple_choice
    );
  } catch (error) {
    console.error("Error handling poll vote:", error);
  }
}
