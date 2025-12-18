export type RoomStatus = 'creating' | 'active' | 'paused' | 'closing' | 'closed' | 'archived';
export type RoomVisibility = 'public' | 'private' | 'friends_only';
export type RoomType = 'lobby' | 'game' | 'social' | 'event' | 'custom';
export type PlayerRole = 'owner' | 'admin' | 'moderator' | 'member' | 'guest';
export type PermissionAction = 'join' | 'leave' | 'invite' | 'kick' | 'ban' | 'mute' | 'update_settings' | 'update_state' | 'delete';

export interface Room {
  id: string;
  name: string;
  description?: string;
  type: RoomType;
  status: RoomStatus;
  visibility: RoomVisibility;
  ownerId: string;
  capacity: number;
  currentPlayerCount: number;
  settings: RoomSettings;
  metadata?: Record<string, unknown>;
  tags?: string[];
  password?: string;
  instanceId?: string;
  parentRoomId?: string;
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt: Date;
  closedAt?: Date;
}

export interface RoomSettings {
  allowSpectators: boolean;
  maxSpectators: number;
  autoClose: boolean;
  autoCloseTimeout: number;
  allowReconnection: boolean;
  reconnectionTimeout: number;
  persistState: boolean;
  stateUpdateInterval: number;
  customSettings?: Record<string, unknown>;
}

export interface RoomPlayer {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  role: PlayerRole;
  isSpectator: boolean;
  position?: Vector3;
  rotation?: Vector3;
  customData?: Record<string, unknown>;
  joinedAt: Date;
  lastActiveAt: Date;
  disconnectedAt?: Date;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface RoomState {
  roomId: string;
  version: number;
  data: Record<string, unknown>;
  lastUpdatedAt: Date;
  lastUpdatedBy?: string;
}

export interface RoomPermission {
  id: string;
  roomId: string;
  role: PlayerRole;
  action: PermissionAction;
  allowed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoomInstance {
  id: string;
  roomId: string;
  serverId: string;
  region: string;
  status: 'starting' | 'running' | 'stopping' | 'stopped';
  connectionUrl: string;
  playerCount: number;
  maxPlayers: number;
  startedAt: Date;
  stoppedAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface RoomEvent {
  id: string;
  roomId: string;
  type: RoomEventType;
  playerId?: string;
  data?: unknown;
  timestamp: Date;
}

export type RoomEventType =
  | 'room_created'
  | 'room_updated'
  | 'room_closed'
  | 'room_archived'
  | 'player_joined'
  | 'player_left'
  | 'player_kicked'
  | 'player_banned'
  | 'player_role_changed'
  | 'state_updated'
  | 'settings_updated'
  | 'instance_started'
  | 'instance_stopped';

export interface CreateRoomInput {
  name: string;
  description?: string;
  type: RoomType;
  visibility?: RoomVisibility;
  ownerId: string;
  capacity?: number;
  settings?: Partial<RoomSettings>;
  metadata?: Record<string, unknown>;
  tags?: string[];
  password?: string;
  parentRoomId?: string;
}

export interface UpdateRoomInput {
  name?: string;
  description?: string;
  visibility?: RoomVisibility;
  capacity?: number;
  settings?: Partial<RoomSettings>;
  metadata?: Record<string, unknown>;
  tags?: string[];
  password?: string;
}

export interface JoinRoomInput {
  roomId: string;
  userId: string;
  username: string;
  password?: string;
  asSpectator?: boolean;
}

export interface UpdatePlayerInput {
  position?: Vector3;
  rotation?: Vector3;
  customData?: Record<string, unknown>;
}

export interface UpdateStateInput {
  data: Record<string, unknown>;
  merge?: boolean;
}

export interface RoomFilter {
  type?: RoomType;
  status?: RoomStatus;
  visibility?: RoomVisibility;
  ownerId?: string;
  tags?: string[];
  search?: string;
  hasCapacity?: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface StateUpdate {
  roomId: string;
  version: number;
  changes: Record<string, unknown>;
  timestamp: Date;
  updatedBy: string;
}

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  allowSpectators: true,
  maxSpectators: 10,
  autoClose: true,
  autoCloseTimeout: 3600000,
  allowReconnection: true,
  reconnectionTimeout: 120000,
  persistState: true,
  stateUpdateInterval: 100,
};

export const DEFAULT_PERMISSIONS: Record<PlayerRole, PermissionAction[]> = {
  owner: ['join', 'leave', 'invite', 'kick', 'ban', 'mute', 'update_settings', 'update_state', 'delete'],
  admin: ['join', 'leave', 'invite', 'kick', 'ban', 'mute', 'update_settings', 'update_state'],
  moderator: ['join', 'leave', 'invite', 'kick', 'mute', 'update_state'],
  member: ['join', 'leave', 'update_state'],
  guest: ['join', 'leave'],
};

export class RoomError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode: number = 400, code: string = 'ROOM_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, RoomError.prototype);
  }
}

export class RoomNotFoundError extends RoomError {
  constructor() {
    super('Room not found', 404, 'ROOM_NOT_FOUND');
  }
}

export class RoomFullError extends RoomError {
  constructor() {
    super('Room is at full capacity', 400, 'ROOM_FULL');
  }
}

export class RoomClosedError extends RoomError {
  constructor() {
    super('Room is closed', 400, 'ROOM_CLOSED');
  }
}

export class PlayerNotInRoomError extends RoomError {
  constructor() {
    super('Player is not in this room', 400, 'PLAYER_NOT_IN_ROOM');
  }
}

export class PlayerAlreadyInRoomError extends RoomError {
  constructor() {
    super('Player is already in this room', 400, 'PLAYER_ALREADY_IN_ROOM');
  }
}

export class InvalidPasswordError extends RoomError {
  constructor() {
    super('Invalid room password', 401, 'INVALID_PASSWORD');
  }
}

export class PermissionDeniedError extends RoomError {
  constructor(action: string) {
    super(`Permission denied for action: ${action}`, 403, 'PERMISSION_DENIED');
  }
}

export class InvalidStateVersionError extends RoomError {
  constructor() {
    super('State version conflict - please refresh and try again', 409, 'STATE_VERSION_CONFLICT');
  }
}
