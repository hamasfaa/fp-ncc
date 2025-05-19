export interface Poll {
  id: string;
  message_id: string;
  question: string;
  is_multiple_choice: boolean;
  expires_at?: string;
  created_at: string;
}

export interface PollOption {
  id: string;
  poll_id: string;
  option_text: string;
  created_at: string;
}

export interface PollVote {
  id: string;
  poll_option_id: string;
  user_id: string;
  created_at: string;
}

export interface PollWithOptions extends Poll {
  options: PollOption[];
}

export interface PollResults extends PollWithOptions {
  votes: {
    option_id: string;
    option_text: string;
    vote_count: number;
    voters: { id: string; username: string }[];
  }[];
}
