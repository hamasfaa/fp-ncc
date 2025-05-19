import { supabase, handleDbError } from "../utils/db.ts";
import {
  Poll,
  PollOption,
  PollVote,
  PollResults,
  PollWithOptions,
} from "../types/poll.type.ts";

export async function createPoll(
  messageId: string,
  question: string,
  options: string[],
  isMultipleChoice = false,
  expiresAt?: Date
): Promise<PollWithOptions> {
  try {
    const { data: poll, error: pollError } = await supabase
      .from("polls")
      .insert({
        message_id: messageId,
        question,
        is_multiple_choice: isMultipleChoice,
        expires_at: expiresAt?.toISOString(),
      })
      .select()
      .single();

    if (pollError) throw new Error(pollError.message);

    const optionRows = options.map((optionText) => ({
      poll_id: poll.id,
      option_text: optionText,
    }));

    const { data: pollOptions, error: optionsError } = await supabase
      .from("poll_options")
      .insert(optionRows)
      .select();

    if (optionsError) throw new Error(optionsError.message);

    return {
      ...poll,
      options: pollOptions,
    };
  } catch (error) {
    return handleDbError(error);
  }
}

export async function voteOnPoll(
  pollOptionId: string,
  userId: string,
  isMultipleChoice: boolean
): Promise<void> {
  try {
    if (!isMultipleChoice) {
      const { data: option, error: optionError } = await supabase
        .from("poll_options")
        .select("poll_id")
        .eq("id", pollOptionId)
        .single();

      if (optionError) throw new Error(optionError.message);

      const { data: pollOptions, error: optionsError } = await supabase
        .from("poll_options")
        .select("id")
        .eq("poll_id", option.poll_id);

      if (optionsError) throw new Error(optionsError.message);

      const optionIds = pollOptions.map((opt) => opt.id);

      const { error: deleteError } = await supabase
        .from("poll_votes")
        .delete()
        .in("poll_option_id", optionIds)
        .eq("user_id", userId);

      if (deleteError) throw new Error(deleteError.message);
    }

    const { error } = await supabase.from("poll_votes").insert({
      poll_option_id: pollOptionId,
      user_id: userId,
    });

    if (error && error.code !== "23505") {
      throw new Error(error.message);
    }
  } catch (error) {
    handleDbError(error);
  }
}

export async function getPollResults(pollId: string): Promise<PollResults> {
  try {
    const { data: poll, error: pollError } = await supabase
      .from("polls")
      .select(
        `
        *,
        options:poll_options(*)
      `
      )
      .eq("id", pollId)
      .single();

    if (pollError) throw new Error(pollError.message);

    const { data: voteData, error: voteError } = await supabase
      .from("poll_options")
      .select(
        `
        id,
        option_text,
        votes:poll_votes(
          id,
          user:user_id(id, username)
        )
      `
      )
      .eq("poll_id", pollId);

    if (voteError) throw new Error(voteError.message);

    const votes = voteData.map((option) => ({
      option_id: option.id,
      option_text: option.option_text,
      vote_count: option.votes ? option.votes.length : 0,
      voters: option.votes
        ? option.votes.map((v: any) => ({
            id: v.user.id,
            username: v.user.username,
          }))
        : [],
    }));

    return {
      ...poll,
      votes,
    };
  } catch (error) {
    console.error("Error in getPollResults:", error);
    throw error;
  }
}
