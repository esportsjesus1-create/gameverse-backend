export interface Camera {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  deviceId?: string;
  capabilities: CameraCapabilities;
  status: CameraStatus;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CameraCapabilities {
  maxResolution: Resolution;
  supportedResolutions: Resolution[];
  maxFramerate: number;
  supportedFramerates: number[];
  hasAudio: boolean;
  hasPanTiltZoom: boolean;
}

export interface Resolution {
  width: number;
  height: number;
}

export enum CameraStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  STREAMING = 'streaming',
  ERROR = 'error'
}

export interface Stream {
  id: string;
  cameraId: string;
  ownerId: string;
  title: string;
  description?: string;
  status: StreamStatus;
  quality: QualityPreset;
  settings: StreamSettings;
  viewerCount: number;
  startedAt?: Date;
  endedAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export enum StreamStatus {
  CREATED = 'created',
  STARTING = 'starting',
  LIVE = 'live',
  PAUSED = 'paused',
  ENDED = 'ended',
  ERROR = 'error'
}

export enum QualityPreset {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  ULTRA = 'ultra',
  AUTO = 'auto'
}

export interface StreamSettings {
  resolution: Resolution;
  framerate: number;
  bitrate: number;
  codec: VideoCodec;
  audioEnabled: boolean;
  audioBitrate?: number;
}

export enum VideoCodec {
  VP8 = 'VP8',
  VP9 = 'VP9',
  H264 = 'H264',
  AV1 = 'AV1'
}

export interface Viewer {
  id: string;
  streamId: string;
  sessionId: string;
  userId?: string;
  connectionState: ConnectionState;
  quality: QualityPreset;
  bandwidth: BandwidthStats;
  joinedAt: Date;
  lastActiveAt: Date;
}

export enum ConnectionState {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  FAILED = 'failed'
}

export interface BandwidthStats {
  estimatedBandwidth: number;
  currentBitrate: number;
  packetLoss: number;
  latency: number;
  jitter: number;
}

export interface Recording {
  id: string;
  streamId: string;
  cameraId: string;
  ownerId: string;
  status: RecordingStatus;
  filePath?: string;
  fileSize?: number;
  duration?: number;
  format: RecordingFormat;
  startedAt?: Date;
  endedAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export enum RecordingStatus {
  PENDING = 'pending',
  RECORDING = 'recording',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export enum RecordingFormat {
  WEBM = 'webm',
  MP4 = 'mp4',
  MKV = 'mkv'
}

export interface SignalingMessage {
  type: SignalingMessageType;
  streamId: string;
  senderId: string;
  payload: unknown;
  timestamp: number;
}

export enum SignalingMessageType {
  OFFER = 'offer',
  ANSWER = 'answer',
  ICE_CANDIDATE = 'ice_candidate',
  JOIN = 'join',
  LEAVE = 'leave',
  QUALITY_CHANGE = 'quality_change',
  ERROR = 'error'
}

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface WebRTCConfig {
  iceServers: IceServer[];
  iceCandidatePoolSize?: number;
}

export interface CreateCameraDto {
  name: string;
  description?: string;
  ownerId: string;
  deviceId?: string;
  capabilities?: Partial<CameraCapabilities>;
  metadata?: Record<string, unknown>;
}

export interface UpdateCameraDto {
  name?: string;
  description?: string;
  deviceId?: string;
  capabilities?: Partial<CameraCapabilities>;
  status?: CameraStatus;
  metadata?: Record<string, unknown>;
}

export interface CreateStreamDto {
  cameraId: string;
  ownerId: string;
  title: string;
  description?: string;
  quality?: QualityPreset;
  settings?: Partial<StreamSettings>;
  metadata?: Record<string, unknown>;
}

export interface UpdateStreamDto {
  title?: string;
  description?: string;
  quality?: QualityPreset;
  settings?: Partial<StreamSettings>;
  metadata?: Record<string, unknown>;
}

export interface StartRecordingDto {
  streamId: string;
  format?: RecordingFormat;
  metadata?: Record<string, unknown>;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface StreamRoom {
  streamId: string;
  broadcaster: string;
  viewers: Map<string, Viewer>;
  maxViewers: number;
  createdAt: Date;
}

export interface QualityLevel {
  preset: QualityPreset;
  resolution: Resolution;
  framerate: number;
  bitrate: number;
}

export interface AdaptiveQualityConfig {
  levels: QualityLevel[];
  adaptationInterval: number;
  bandwidthThresholds: {
    low: number;
    medium: number;
    high: number;
    ultra: number;
  };
}
