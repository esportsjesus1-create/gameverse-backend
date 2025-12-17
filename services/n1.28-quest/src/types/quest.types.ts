export enum QuestType {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  SPECIAL = 'special'
}

export enum QuestStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  EXPIRED = 'expired'
}

export enum UserQuestStatus {
  AVAILABLE = 'available',
  ACCEPTED = 'accepted',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CLAIMED = 'claimed',
  EXPIRED = 'expired'
}

export enum ObjectiveType {
  KILL = 'kill',
  COLLECT = 'collect',
  ACHIEVE = 'achieve',
  VISIT = 'visit',
  INTERACT = 'interact',
  WIN = 'win',
  PLAY = 'play',
  SPEND = 'spend',
  EARN = 'earn'
}

export enum RewardType {
  XP = 'xp',
  CURRENCY = 'currency',
  ITEM = 'item',
  ACHIEVEMENT = 'achievement',
  BADGE = 'badge',
  TITLE = 'title'
}

export interface Quest {
  id: string;
  name: string;
  description: string;
  type: QuestType;
  status: QuestStatus;
  requiredLevel: number;
  objectives: QuestObjective[];
  rewards: QuestReward[];
  startsAt: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuestObjective {
  id: string;
  questId: string;
  type: ObjectiveType;
  description: string;
  targetValue: number;
  targetId?: string;
  orderIndex: number;
  isOptional: boolean;
}

export interface QuestReward {
  id: string;
  questId: string;
  type: RewardType;
  value: number;
  itemId?: string;
  metadata?: Record<string, unknown>;
}

export interface UserQuest {
  id: string;
  oderId: string;
  questId: string;
  status: UserQuestStatus;
  acceptedAt: Date;
  completedAt?: Date;
  claimedAt?: Date;
  expiresAt: Date;
  progress: UserQuestProgress[];
}

export interface UserQuestProgress {
  id: string;
  userQuestId: string;
  objectiveId: string;
  currentValue: number;
  isCompleted: boolean;
  updatedAt: Date;
}

export interface UserReward {
  id: string;
  oderId: string;
  questId: string;
  rewardId: string;
  type: RewardType;
  value: number;
  itemId?: string;
  claimedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface CreateQuestInput {
  name: string;
  description: string;
  type: QuestType;
  requiredLevel?: number;
  objectives: CreateObjectiveInput[];
  rewards: CreateRewardInput[];
  startsAt?: Date;
  expiresAt?: Date;
}

export interface CreateObjectiveInput {
  type: ObjectiveType;
  description: string;
  targetValue: number;
  targetId?: string;
  orderIndex?: number;
  isOptional?: boolean;
}

export interface CreateRewardInput {
  type: RewardType;
  value: number;
  itemId?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateProgressInput {
  objectiveId: string;
  incrementBy?: number;
  setValue?: number;
}

export interface QuestFilter {
  type?: QuestType;
  status?: QuestStatus;
  minLevel?: number;
  maxLevel?: number;
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
