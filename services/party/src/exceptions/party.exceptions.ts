import { HttpException, HttpStatus } from '@nestjs/common';

export enum PartyErrorCode {
  PARTY_NOT_FOUND = 'PARTY_001',
  PARTY_ALREADY_EXISTS = 'PARTY_002',
  PARTY_FULL = 'PARTY_003',
  PARTY_NOT_ACTIVE = 'PARTY_004',
  PARTY_DISBANDED = 'PARTY_005',
  PARTY_IN_MATCHMAKING = 'PARTY_006',
  PARTY_NOT_IN_MATCHMAKING = 'PARTY_007',
  INVALID_JOIN_CODE = 'PARTY_008',
  JOIN_CODE_EXPIRED = 'PARTY_009',

  MEMBER_NOT_FOUND = 'MEMBER_001',
  MEMBER_ALREADY_EXISTS = 'MEMBER_002',
  MEMBER_IN_ANOTHER_PARTY = 'MEMBER_003',
  MEMBER_NOT_READY = 'MEMBER_004',
  MEMBER_MUTED = 'MEMBER_005',
  MEMBER_RANK_MISMATCH = 'MEMBER_006',
  INSUFFICIENT_WALLET_BALANCE = 'MEMBER_007',

  PERMISSION_DENIED = 'PERM_001',
  NOT_PARTY_LEADER = 'PERM_002',
  NOT_PARTY_MEMBER = 'PERM_003',
  CANNOT_KICK_LEADER = 'PERM_004',
  CANNOT_KICK_SELF = 'PERM_005',
  CANNOT_MODIFY_LEADER_PERMISSIONS = 'PERM_006',

  INVITE_NOT_FOUND = 'INVITE_001',
  INVITE_EXPIRED = 'INVITE_002',
  INVITE_ALREADY_RESPONDED = 'INVITE_003',
  INVITE_NOT_FOR_USER = 'INVITE_004',
  INVITE_MAX_USES_REACHED = 'INVITE_005',
  INVITE_ALREADY_PENDING = 'INVITE_006',
  CANNOT_INVITE_NON_FRIEND = 'INVITE_007',

  MESSAGE_NOT_FOUND = 'CHAT_001',
  CHAT_DISABLED = 'CHAT_002',
  CANNOT_EDIT_DELETED_MESSAGE = 'CHAT_003',
  CANNOT_EDIT_OTHERS_MESSAGE = 'CHAT_004',
  MAX_PINNED_MESSAGES = 'CHAT_005',
  MESSAGE_TOO_LONG = 'CHAT_006',

  MATCHMAKING_ALREADY_ACTIVE = 'MATCH_001',
  MATCHMAKING_NOT_ACTIVE = 'MATCH_002',
  NOT_ALL_MEMBERS_READY = 'MATCH_003',
  READY_CHECK_ALREADY_ACTIVE = 'MATCH_004',
  READY_CHECK_NOT_ACTIVE = 'MATCH_005',
  READY_CHECK_COMPLETED = 'MATCH_006',
  NOT_PART_OF_READY_CHECK = 'MATCH_007',

  SETTINGS_NOT_FOUND = 'SETTINGS_001',
  INVALID_SETTING_VALUE = 'SETTINGS_002',
  WAGER_ALREADY_ENABLED = 'SETTINGS_003',
  WAGER_NOT_ENABLED = 'SETTINGS_004',

  VALIDATION_ERROR = 'VALIDATION_001',
  RATE_LIMIT_EXCEEDED = 'RATE_001',
  INTERNAL_ERROR = 'INTERNAL_001',
}

export interface PartyExceptionResponse {
  statusCode: number;
  errorCode: PartyErrorCode;
  message: string;
  timestamp: string;
  path?: string;
  details?: Record<string, unknown>;
}

export class PartyException extends HttpException {
  constructor(
    public readonly errorCode: PartyErrorCode,
    message: string,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly details?: Record<string, unknown>,
  ) {
    const response: PartyExceptionResponse = {
      statusCode,
      errorCode,
      message,
      timestamp: new Date().toISOString(),
      details,
    };
    super(response, statusCode);
  }

  getErrorCode(): PartyErrorCode {
    return this.errorCode;
  }
}

export class PartyNotFoundException extends PartyException {
  constructor(partyId?: string) {
    super(
      PartyErrorCode.PARTY_NOT_FOUND,
      partyId ? `Party with ID ${partyId} not found` : 'Party not found',
      HttpStatus.NOT_FOUND,
      partyId ? { partyId } : undefined,
    );
  }
}

export class PartyFullException extends PartyException {
  constructor(partyId: string, maxSize: number) {
    super(
      PartyErrorCode.PARTY_FULL,
      `Party is full (max ${maxSize} members)`,
      HttpStatus.BAD_REQUEST,
      { partyId, maxSize },
    );
  }
}

export class PartyNotActiveException extends PartyException {
  constructor(partyId: string, status: string) {
    super(
      PartyErrorCode.PARTY_NOT_ACTIVE,
      `Party is not active (current status: ${status})`,
      HttpStatus.BAD_REQUEST,
      { partyId, status },
    );
  }
}

export class PartyInMatchmakingException extends PartyException {
  constructor(partyId: string) {
    super(
      PartyErrorCode.PARTY_IN_MATCHMAKING,
      'Cannot perform this action while party is in matchmaking',
      HttpStatus.CONFLICT,
      { partyId },
    );
  }
}

export class PartyNotInMatchmakingException extends PartyException {
  constructor(partyId: string) {
    super(
      PartyErrorCode.PARTY_NOT_IN_MATCHMAKING,
      'Party is not currently in matchmaking',
      HttpStatus.BAD_REQUEST,
      { partyId },
    );
  }
}

export class InvalidJoinCodeException extends PartyException {
  constructor() {
    super(
      PartyErrorCode.INVALID_JOIN_CODE,
      'Invalid or expired join code',
      HttpStatus.NOT_FOUND,
    );
  }
}

export class MemberNotFoundException extends PartyException {
  constructor(partyId: string, userId: string) {
    super(
      PartyErrorCode.MEMBER_NOT_FOUND,
      'Member not found in party',
      HttpStatus.NOT_FOUND,
      { partyId, userId },
    );
  }
}

export class MemberAlreadyExistsException extends PartyException {
  constructor(partyId: string, userId: string) {
    super(
      PartyErrorCode.MEMBER_ALREADY_EXISTS,
      'User is already a member of this party',
      HttpStatus.CONFLICT,
      { partyId, userId },
    );
  }
}

export class MemberInAnotherPartyException extends PartyException {
  constructor(userId: string, existingPartyId: string) {
    super(
      PartyErrorCode.MEMBER_IN_ANOTHER_PARTY,
      'User is already in another party',
      HttpStatus.CONFLICT,
      { userId, existingPartyId },
    );
  }
}

export class InsufficientWalletBalanceException extends PartyException {
  constructor(userId: string, required: string, currency: string) {
    super(
      PartyErrorCode.INSUFFICIENT_WALLET_BALANCE,
      `Insufficient wallet balance. Required: ${required} ${currency}`,
      HttpStatus.PAYMENT_REQUIRED,
      { userId, required, currency },
    );
  }
}

export class MemberRankMismatchException extends PartyException {
  constructor(userId: string, userRank: number, minRank: number, maxRank: number) {
    super(
      PartyErrorCode.MEMBER_RANK_MISMATCH,
      `User rank (${userRank}) does not meet party requirements (${minRank}-${maxRank})`,
      HttpStatus.BAD_REQUEST,
      { userId, userRank, minRank, maxRank },
    );
  }
}

export class PermissionDeniedException extends PartyException {
  constructor(permission: string, userId?: string) {
    super(
      PartyErrorCode.PERMISSION_DENIED,
      `Permission denied: ${permission}`,
      HttpStatus.FORBIDDEN,
      userId ? { userId, permission } : { permission },
    );
  }
}

export class NotPartyLeaderException extends PartyException {
  constructor(action: string) {
    super(
      PartyErrorCode.NOT_PARTY_LEADER,
      `Only the party leader can ${action}`,
      HttpStatus.FORBIDDEN,
      { action },
    );
  }
}

export class NotPartyMemberException extends PartyException {
  constructor(partyId: string, userId: string) {
    super(
      PartyErrorCode.NOT_PARTY_MEMBER,
      'User is not a member of this party',
      HttpStatus.FORBIDDEN,
      { partyId, userId },
    );
  }
}

export class CannotKickLeaderException extends PartyException {
  constructor() {
    super(
      PartyErrorCode.CANNOT_KICK_LEADER,
      'Cannot kick the party leader',
      HttpStatus.FORBIDDEN,
    );
  }
}

export class CannotKickSelfException extends PartyException {
  constructor() {
    super(
      PartyErrorCode.CANNOT_KICK_SELF,
      'Cannot kick yourself from the party',
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class InviteNotFoundException extends PartyException {
  constructor(inviteId?: string) {
    super(
      PartyErrorCode.INVITE_NOT_FOUND,
      inviteId ? `Invite with ID ${inviteId} not found` : 'Invite not found',
      HttpStatus.NOT_FOUND,
      inviteId ? { inviteId } : undefined,
    );
  }
}

export class InviteExpiredException extends PartyException {
  constructor(inviteId: string) {
    super(
      PartyErrorCode.INVITE_EXPIRED,
      'Invite has expired',
      HttpStatus.GONE,
      { inviteId },
    );
  }
}

export class InviteAlreadyRespondedException extends PartyException {
  constructor(inviteId: string, status: string) {
    super(
      PartyErrorCode.INVITE_ALREADY_RESPONDED,
      `Invite has already been ${status}`,
      HttpStatus.CONFLICT,
      { inviteId, status },
    );
  }
}

export class InviteNotForUserException extends PartyException {
  constructor(inviteId: string) {
    super(
      PartyErrorCode.INVITE_NOT_FOR_USER,
      'This invite is not for you',
      HttpStatus.FORBIDDEN,
      { inviteId },
    );
  }
}

export class InviteMaxUsesReachedException extends PartyException {
  constructor(inviteId: string, maxUses: number) {
    super(
      PartyErrorCode.INVITE_MAX_USES_REACHED,
      `Invite has reached maximum uses (${maxUses})`,
      HttpStatus.GONE,
      { inviteId, maxUses },
    );
  }
}

export class InviteAlreadyPendingException extends PartyException {
  constructor(partyId: string, userId: string) {
    super(
      PartyErrorCode.INVITE_ALREADY_PENDING,
      'User already has a pending invite to this party',
      HttpStatus.CONFLICT,
      { partyId, userId },
    );
  }
}

export class CannotInviteNonFriendException extends PartyException {
  constructor() {
    super(
      PartyErrorCode.CANNOT_INVITE_NON_FRIEND,
      'Can only invite friends in friends-only parties',
      HttpStatus.FORBIDDEN,
    );
  }
}

export class MessageNotFoundException extends PartyException {
  constructor(messageId?: string) {
    super(
      PartyErrorCode.MESSAGE_NOT_FOUND,
      messageId ? `Message with ID ${messageId} not found` : 'Message not found',
      HttpStatus.NOT_FOUND,
      messageId ? { messageId } : undefined,
    );
  }
}

export class ChatDisabledException extends PartyException {
  constructor(partyId: string) {
    super(
      PartyErrorCode.CHAT_DISABLED,
      'Chat is disabled for this party',
      HttpStatus.FORBIDDEN,
      { partyId },
    );
  }
}

export class MemberMutedException extends PartyException {
  constructor(partyId: string, userId: string) {
    super(
      PartyErrorCode.MEMBER_MUTED,
      'You are muted in this party',
      HttpStatus.FORBIDDEN,
      { partyId, userId },
    );
  }
}

export class CannotEditDeletedMessageException extends PartyException {
  constructor(messageId: string) {
    super(
      PartyErrorCode.CANNOT_EDIT_DELETED_MESSAGE,
      'Cannot edit a deleted message',
      HttpStatus.BAD_REQUEST,
      { messageId },
    );
  }
}

export class CannotEditOthersMessageException extends PartyException {
  constructor(messageId: string) {
    super(
      PartyErrorCode.CANNOT_EDIT_OTHERS_MESSAGE,
      'You can only edit your own messages',
      HttpStatus.FORBIDDEN,
      { messageId },
    );
  }
}

export class MaxPinnedMessagesException extends PartyException {
  constructor(partyId: string, maxPinned: number) {
    super(
      PartyErrorCode.MAX_PINNED_MESSAGES,
      `Maximum ${maxPinned} pinned messages allowed`,
      HttpStatus.BAD_REQUEST,
      { partyId, maxPinned },
    );
  }
}

export class MatchmakingAlreadyActiveException extends PartyException {
  constructor(partyId: string) {
    super(
      PartyErrorCode.MATCHMAKING_ALREADY_ACTIVE,
      'Party is already in matchmaking',
      HttpStatus.CONFLICT,
      { partyId },
    );
  }
}

export class MatchmakingNotActiveException extends PartyException {
  constructor(partyId: string) {
    super(
      PartyErrorCode.MATCHMAKING_NOT_ACTIVE,
      'Party is not in matchmaking',
      HttpStatus.BAD_REQUEST,
      { partyId },
    );
  }
}

export class NotAllMembersReadyException extends PartyException {
  constructor(partyId: string, readyCount: number, totalCount: number) {
    super(
      PartyErrorCode.NOT_ALL_MEMBERS_READY,
      `Not all party members are ready (${readyCount}/${totalCount})`,
      HttpStatus.PRECONDITION_FAILED,
      { partyId, readyCount, totalCount },
    );
  }
}

export class ReadyCheckAlreadyActiveException extends PartyException {
  constructor(partyId: string) {
    super(
      PartyErrorCode.READY_CHECK_ALREADY_ACTIVE,
      'A ready check is already in progress',
      HttpStatus.CONFLICT,
      { partyId },
    );
  }
}

export class ReadyCheckNotActiveException extends PartyException {
  constructor(partyId: string) {
    super(
      PartyErrorCode.READY_CHECK_NOT_ACTIVE,
      'No active ready check',
      HttpStatus.NOT_FOUND,
      { partyId },
    );
  }
}

export class ReadyCheckCompletedException extends PartyException {
  constructor(partyId: string) {
    super(
      PartyErrorCode.READY_CHECK_COMPLETED,
      'Ready check has already completed',
      HttpStatus.BAD_REQUEST,
      { partyId },
    );
  }
}

export class NotPartOfReadyCheckException extends PartyException {
  constructor(partyId: string, userId: string) {
    super(
      PartyErrorCode.NOT_PART_OF_READY_CHECK,
      'You are not part of this ready check',
      HttpStatus.FORBIDDEN,
      { partyId, userId },
    );
  }
}

export class SettingsNotFoundException extends PartyException {
  constructor(partyId: string) {
    super(
      PartyErrorCode.SETTINGS_NOT_FOUND,
      'Party settings not found',
      HttpStatus.NOT_FOUND,
      { partyId },
    );
  }
}

export class ValidationException extends PartyException {
  constructor(message: string, details?: Record<string, unknown>) {
    super(
      PartyErrorCode.VALIDATION_ERROR,
      message,
      HttpStatus.BAD_REQUEST,
      details,
    );
  }
}

export class RateLimitExceededException extends PartyException {
  constructor(limit: number, windowSeconds: number) {
    super(
      PartyErrorCode.RATE_LIMIT_EXCEEDED,
      `Rate limit exceeded. Maximum ${limit} requests per ${windowSeconds} seconds`,
      HttpStatus.TOO_MANY_REQUESTS,
      { limit, windowSeconds },
    );
  }
}
