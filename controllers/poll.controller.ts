import { Context } from "../deps.ts";
import {
  createChatPoll,
  submitPollVote,
  getPollData,
} from "../services/poll.service.ts";
import { supabase } from "../utils/db.ts";

export async function createPoll(ctx: Context) {
  try {
    const userId = ctx.state.user.id;
    const conversationId = ctx.params.id;
    const body = await ctx.request.body.json();

    if (!body.question) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Poll question is required" };
      return;
    }

    if (!body.question) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Poll question is required" };
      return;
    }

    if (!Array.isArray(body.options) || body.options.length < 2) {
      ctx.response.status = 400;
      ctx.response.body = { error: "At least two poll options are required" };
      return;
    }

    const result = await createChatPoll(
      userId,
      conversationId,
      body.question,
      body.options,
      body.is_multiple_choice || false,
      body.expires_in_hours
    );

    if (!result.success) {
      ctx.response.status = 500;
      ctx.response.body = { error: result.error };
      return;
    }

    ctx.response.status = 201;
    ctx.response.body = {
      poll_id: result.pollId,
      message_id: result.messageId,
    };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to create poll" };
  }
}

export async function votePoll(ctx: Context) {
  try {
    const userId = ctx.state.user.id;
    const pollId = ctx.params.id;
    const body = await ctx.request.body.json();

    if (!body.option_id) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Option ID is required" };
      return;
    }
    const pollData = await getPollData(pollId);

    if (pollData.expires_at && new Date(pollData.expires_at) < new Date()) {
      ctx.response.status = 400;
      ctx.response.body = { error: "This poll has expired" };
      return;
    }

    const { data: message } = await supabase
      .from("messages")
      .select("conversation_id")
      .eq("id", pollData.message_id)
      .single();

    if (!message) {
      ctx.response.status = 404;
      ctx.response.body = { error: "Poll not found" };
      return;
    }

    const result = await submitPollVote(
      userId,
      message.conversation_id,
      pollId,
      body.option_id,
      pollData.is_multiple_choice
    );

    if (!result.success) {
      ctx.response.status = 500;
      ctx.response.body = { error: result.error };
      return;
    }

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      results: result.results,
    };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to submit vote" };
  }
}

export async function getPollResults(ctx: Context) {
  try {
    const pollId = ctx.params.id;
    const results = await getPollData(pollId);

    ctx.response.status = 200;
    ctx.response.body = { results };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to get poll results" };
  }
}
