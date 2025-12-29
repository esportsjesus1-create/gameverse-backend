export enum PartyEventType {
  PARTY_CREATED = 'party.created',
  PARTY_UPDATED = 'party.updated',
  PARTY_DISBANDED = 'party.disbanded',
  PARTY_GAME_CHANGED = 'party.game_changed',
  
  MEMBER_JOINED = 'member.joined',
  MEMBER_LEFT = 'member.left',
  MEMBER_KICKED = 'member.kicked',
  MEMBER_ROLE_CHANGED = 'member.role_changed',
  MEMBER_STATUS_CHANGED = 'member.status_changed',
  MEMBER_READY_CHANGED = 'member.ready_changed',
  MEMBER_PERMISSIONS_CHANGED = 'member.permissions_changed',
  
  LEADER_CHANGED = 'leader.changed',
  
  INVITE_SENT = 'invite.sent',
  INVITE_RECEIVED = 'invite.received',
  INVITE_ACCEPTED = 'invite.accepted',
  INVITE_DECLINED = 'invite.declined',
  INVITE_CANCELLED = 'invite.cancelled',
  INVITE_EXPIRED = 'invite.expired',
  
  CHAT_MESSAGE = 'chat.message',
  CHAT_MESSAGE_EDITED = 'chat.message_edited',
  CHAT_MESSAGE_DELETED = 'chat.message_deleted',
  CHAT_MESSAGE_PINNED = 'chat.message_pinned',
  CHAT_MESSAGE_UNPINNED = 'chat.message_unpinned',
  CHAT_REACTION_ADDED = 'chat.reaction_added',
  CHAT_REACTION_REMOVED = 'chat.reaction_removed',
  CHAT_TYPING = 'chat.typing',
  
  SETTINGS_UPDATED = 'settings.updated',
  
  MATCHMAKING_STARTED = 'matchmaking.started',
  MATCHMAKING_CANCELLED = 'matchmaking.cancelled',
  MATCHMAKING_PROGRESS = 'matchmaking.progress',
  MATCHMAKING_FOUND = 'matchmaking.found',
  MATCHMAKING_FAILED = 'matchmaking.failed',
  
  READY_CHECK_STARTED = 'ready_check.started',
  READY_CHECK_RESPONSE = 'ready_check.response',
  READY_CHECK_COMPLETED = 'ready_check.completed',
  READY_CHECK_FAILED = 'ready_check.failed',
  
  MATCH_STARTING = 'match.starting',
  MATCH_STARTED = 'match.started',
  MATCH_ENDED = 'match.ended',
  
  VOICE_USER_JOINED = 'voice.user_joined',
  VOICE_USER_LEFT = 'voice.user_left',
  VOICE_USER_MUTED = 'voice.user_muted',
  VOICE_USER_UNMUTED = 'voice.user_unmuted',
  VOICE_USER_DEAFENED = 'voice.user_deafened',
  VOICE_USER_UNDEAFENED = 'voice.user_undeafened',
}

export interface PartyEvent<T = unknown> {
  type: PartyEventType;
  partyId: string;
  userId?: string;
  timestamp: Date;
  data: T;
}

export interface PartyCreatedEvent {
  party: {
    id: string;
    name: string;
    leaderId: string;
    leaderUsername: string;
    gameId?: string;
    gameName?: string;
    visibility: string;
    maxSize: number;
  };
}

export interface MemberJoinedEvent {
  member: {
    userId: string;
    username: string;
    avatarUrl?: string;
    role: string;
    rank?: number;
  };
  currentSize: number;
}

export interface MemberLeftEvent {
  userId: string;
  username: string;
  reason: 'left' | 'kicked' | 'disconnected';
  currentSize: number;
}

export interface ChatMessageEvent {
  message: {
    id: string;
    senderId: string;
    senderUsername: string;
    content: string;
    type: string;
    createdAt: Date;
  };
}

export interface MatchmakingProgressEvent {
  ticketId: string;
  timeInQueue: number;
  estimatedWaitTime: number;
  playersFound: number;
  playersNeeded: number;
  searchExpanded: boolean;
}

export interface MatchFoundEvent {
  matchId: string;
  serverInfo: {
    ip: string;
    port: number;
    region: string;
    connectionToken: string;
  };
  teams: Array<{
    teamId: string;
    players: Array<{
      odId: string;
      username: string;
    }>;
  }>;
}

export interface ReadyCheckEvent {
  initiatorId: string;
  timeout: number;
  responses: Record<string, boolean | null>;
}
