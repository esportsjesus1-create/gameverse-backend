export interface User {
  id: string;
  username: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  status: 'online' | 'offline' | 'away' | 'busy' | 'invisible';
  level: number;
  experience_points: number;
  premium_status: 'free' | 'basic' | 'premium' | 'vip';
  last_login_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Party {
  id: string;
  name: string;
  leader_id: string;
  max_size: number;
  current_size: number;
  is_private: boolean;
  password_hash?: string;
  status: 'active' | 'in_game' | 'disbanded' | 'full';
  voice_channel_id?: string;
  game_mode?: string;
  game_id?: string;
  region: string;
  settings: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  disbanded_at?: Date;
}

export interface PartyMember {
  id: string;
  party_id: string;
  user_id: string;
  role: 'leader' | 'co-leader' | 'member';
  joined_at: Date;
  is_ready: boolean;
  is_muted: boolean;
  is_deafened: boolean;
  permissions: Record<string, boolean>;
}

export interface PartyInvite {
  id: string;
  party_id: string;
  sender_id: string;
  recipient_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';
  message?: string;
  expires_at: Date;
  created_at: Date;
  responded_at?: Date;
}

export interface VoiceChannel {
  id: string;
  party_id: string;
  name: string;
  max_participants: number;
  bitrate: number;
  is_active: boolean;
  created_at: Date;
}

export interface VoiceParticipant {
  id: string;
  channel_id: string;
  user_id: string;
  is_muted: boolean;
  is_deafened: boolean;
  is_speaking: boolean;
  is_streaming: boolean;
  joined_at: Date;
}

export interface PartyBenefit {
  id: string;
  name: string;
  description?: string;
  type:
    | 'xp_multiplier'
    | 'loot_bonus'
    | 'achievement_bonus'
    | 'drop_rate_bonus'
    | 'exclusive_reward'
    | 'currency_bonus';
  value: number;
  min_party_size: number;
  max_party_size?: number;
  is_active: boolean;
  start_date?: Date;
  end_date?: Date;
}

export interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  nickname?: string;
  favorite: boolean;
  created_at: Date;
  accepted_at?: Date;
}

export interface FriendRequest {
  id: string;
  sender_id: string;
  recipient_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  message?: string;
  created_at: Date;
  responded_at?: Date;
}

export interface BlockedUser {
  id: string;
  user_id: string;
  blocked_user_id: string;
  reason?: string;
  created_at: Date;
}

export interface DirectMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  content_type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'sticker' | 'gif';
  attachment_url?: string;
  is_read: boolean;
  is_edited: boolean;
  is_deleted: boolean;
  reply_to_id?: string;
  created_at: Date;
  edited_at?: Date;
  read_at?: Date;
}

export interface UserPresence {
  id: string;
  user_id: string;
  status: 'online' | 'offline' | 'away' | 'busy' | 'invisible';
  custom_status?: string;
  activity_type?: string;
  activity_name?: string;
  activity_details?: string;
  last_seen_at: Date;
  updated_at: Date;
}

export interface Tournament {
  id: string;
  name: string;
  description?: string;
  game_id: string;
  game_mode: string;
  organizer_id: string;
  type: 'single_elimination' | 'double_elimination' | 'round_robin' | 'swiss' | 'custom';
  format: 'solo' | 'duo' | 'squad' | 'team';
  team_size: number;
  min_participants: number;
  max_participants: number;
  current_participants: number;
  entry_fee: number;
  entry_fee_currency: string;
  prize_pool: number;
  prize_pool_currency: string;
  prize_distribution: PrizeDistribution[];
  status:
    | 'draft'
    | 'registration_open'
    | 'registration_closed'
    | 'in_progress'
    | 'completed'
    | 'cancelled';
  visibility: 'public' | 'private' | 'invite_only';
  region: string;
  rules?: string;
  settings: Record<string, unknown>;
  registration_start_at?: Date;
  registration_end_at?: Date;
  start_at: Date;
  end_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface PrizeDistribution {
  placement: number;
  percentage: number;
  amount?: number;
}

export interface TournamentParticipant {
  id: string;
  tournament_id: string;
  user_id: string;
  team_id?: string;
  seed?: number;
  status: 'registered' | 'checked_in' | 'active' | 'eliminated' | 'disqualified' | 'withdrawn';
  check_in_at?: Date;
  eliminated_at?: Date;
  final_placement?: number;
  stats: Record<string, unknown>;
  created_at: Date;
}

export interface TournamentTeam {
  id: string;
  tournament_id: string;
  name: string;
  tag?: string;
  captain_id: string;
  logo_url?: string;
  seed?: number;
  status: 'registered' | 'checked_in' | 'active' | 'eliminated' | 'disqualified' | 'withdrawn';
  final_placement?: number;
  stats: Record<string, unknown>;
  created_at: Date;
}

export interface TournamentMatch {
  id: string;
  tournament_id: string;
  round_id: string;
  match_number: number;
  participant1_id?: string;
  participant2_id?: string;
  team1_id?: string;
  team2_id?: string;
  winner_id?: string;
  loser_id?: string;
  score1: number;
  score2: number;
  status: 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'forfeit';
  scheduled_at?: Date;
  started_at?: Date;
  completed_at?: Date;
  game_data: unknown[];
  created_at: Date;
}

export interface TournamentRound {
  id: string;
  tournament_id: string;
  round_number: number;
  name?: string;
  type: 'winners' | 'losers' | 'grand_final' | 'group_stage' | 'swiss';
  best_of: number;
  status: 'pending' | 'in_progress' | 'completed';
  start_at?: Date;
  end_at?: Date;
  created_at: Date;
}

export interface Season {
  id: string;
  name: string;
  description?: string;
  game_id: string;
  season_number: number;
  type: 'ranked' | 'casual' | 'event' | 'battle_pass';
  status: 'upcoming' | 'active' | 'ended' | 'archived';
  tier_system: 'standard' | 'elo' | 'glicko' | 'custom';
  initial_mmr: number;
  mmr_k_factor: number;
  placement_matches: number;
  decay_enabled: boolean;
  decay_days: number;
  decay_amount: number;
  max_decay_tier?: string;
  rewards_enabled: boolean;
  settings: Record<string, unknown>;
  start_at: Date;
  end_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface SeasonTier {
  id: string;
  season_id: string;
  name: string;
  display_name: string;
  tier_order: number;
  division_count: number;
  min_mmr: number;
  max_mmr?: number;
  icon_url?: string;
  color?: string;
  promotion_series: boolean;
  promotion_wins_required: number;
  promotion_games: number;
  created_at: Date;
}

export interface SeasonPlayer {
  id: string;
  season_id: string;
  user_id: string;
  current_mmr: number;
  peak_mmr: number;
  tier_id?: string;
  division: number;
  league_points: number;
  wins: number;
  losses: number;
  draws: number;
  win_streak: number;
  best_win_streak: number;
  placement_games_played: number;
  placement_completed: boolean;
  in_promotion_series: boolean;
  promotion_wins: number;
  promotion_losses: number;
  last_game_at?: Date;
  last_decay_at?: Date;
  stats: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface SeasonMatch {
  id: string;
  season_id: string;
  game_id: string;
  match_type: 'ranked' | 'placement' | 'promotion' | 'casual';
  player1_id: string;
  player2_id?: string;
  team1_ids?: string[];
  team2_ids?: string[];
  winner_id?: string;
  player1_mmr_before?: number;
  player1_mmr_after?: number;
  player1_mmr_change?: number;
  player2_mmr_before?: number;
  player2_mmr_after?: number;
  player2_mmr_change?: number;
  duration_seconds?: number;
  game_data: Record<string, unknown>;
  status: 'in_progress' | 'completed' | 'cancelled' | 'abandoned';
  started_at?: Date;
  completed_at?: Date;
  created_at: Date;
}

export interface SeasonReward {
  id: string;
  season_id: string;
  tier_id?: string;
  min_rank?: number;
  max_rank?: number;
  reward_type: 'currency' | 'item' | 'badge' | 'title' | 'skin' | 'emote' | 'border' | 'custom';
  reward_value?: number;
  reward_currency?: string;
  reward_item_id?: string;
  reward_description?: string;
  reward_icon_url?: string;
  is_exclusive: boolean;
  created_at: Date;
}

export interface LeaderboardEntry {
  id: string;
  leaderboard_id: string;
  user_id: string;
  rank: number;
  previous_rank?: number;
  score: number;
  tier_id?: string;
  stats: Record<string, unknown>;
  updated_at: Date;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface FilterParams {
  status?: string;
  type?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
}
