import {
  createPoll,
  voteOnPoll,
  getPollResults,
} from "../models/poll.model.ts";
import { MessageType } from "../types/ws.type.ts";
import { wsManager } from "../utils/wsManager.ts";
import { sendChatMessage } from "./chat.service.ts";

export async function createChatPoll(
  userId: string,
  conversationId: string,
  question: string,
  options: string[],
  isMultipleChoice = false,
  expiresInHours?: number
) {
  try {
    const message = await sendChatMessage(
      userId,
      conversationId,
      question,
      "poll"
    );

    let expiresAt: Date | undefined = undefined;
    if (expiresInHours) {
      expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expiresInHours);
    }

    const poll = await createPoll(
      message.id,
      question,
      options,
      isMultipleChoice,
      expiresAt
    );

    await wsManager.sendToConversation(conversationId, {
      type: MessageType.POLL,
      data: {
        message_id: message.id,
        poll_id: poll.id,
        question,
        options: poll.options.map((opt) => ({
          id: opt.id,
          text: opt.option_text,
        })),
        is_multiple_choice: isMultipleChoice,
        expires_at: expiresAt?.toISOString(),
      },
      conversation_id: conversationId,
      sender_id: userId,
      timestamp: Date.now(),
      sender: {},
    });

    return { success: true, messageId: message.id, pollId: poll.id };
  } catch (error) {
    console.error("Poll creation error:", error);
    return { success: false, error: error.message };
  }
}

export async function submitPollVote(
  userId: string,
  conversationId: string,
  pollId: string,
  optionId: string,
  isMultipleChoice: boolean
) {
  try {
    await voteOnPoll(optionId, userId, isMultipleChoice);

    const results = await getPollResults(pollId);

    const formattedVotes = results.votes.map((vote) => ({
      option_id: vote.option_id,
      option_text: vote.option_text,
      vote_count: vote.vote_count,
      voters: vote.voters,
    }));

    await wsManager.sendToConversation(conversationId, {
      type: MessageType.POLL,
      data: {
        poll_id: pollId,
        updated_results: results.votes,
      },
      conversation_id: conversationId,
      sender_id: userId,
      timestamp: Date.now(),
      sender: {},
    });

    return { success: true, results: formattedVotes };
  } catch (error) {
    console.error("Poll vote error:", error);
    return { success: false, error: error.message };
  }
}

export async function getPollData(pollId: string) {
  try {
    return await getPollResults(pollId);
  } catch (error) {
    console.error("Get poll results error:", error);
    throw error;
  }
}
