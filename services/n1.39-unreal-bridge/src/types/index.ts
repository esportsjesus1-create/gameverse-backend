import { z } from 'zod';

export const MessageTypeSchema = z.enum([
  'CONNECT',
  'DISCONNECT',
  'HEARTBEAT',
  'STATE_SYNC',
  'STATE_UPDATE',
  'ASSET_REQUEST',
  'ASSET_CHUNK',
  'ASSET_COMPLETE',
  'RPC_REQUEST',
  'RPC_RESPONSE',
  'EVENT',
  'ERROR',
  'ACK'
]);

export type MessageType = z.infer<typeof MessageTypeSchema>;

export const ConnectionStateSchema = z.enum([
  'CONNECTING',
  'CONNECTED',
  'AUTHENTICATED',
  'DISCONNECTING',
  'DISCONNECTED',
  'ERROR'
]);

export type ConnectionState = z.infer<typeof ConnectionStateSchema>;

export const ClientInfoSchema = z.object({
  clientId: z.string().uuid(),
  sessionId: z.string().uuid(),
  unrealVersion: z.string(),
  platform: z.enum(['Windows', 'Linux', 'Mac', 'PS5', 'Xbox', 'Switch', 'iOS', 'Android']),
  buildVersion: z.string(),
  metadata: z.record(z.string()).optional()
});

export type ClientInfo = z.infer<typeof ClientInfoSchema>;

export const MessageHeaderSchema = z.object({
  id: z.string().uuid(),
  type: MessageTypeSchema,
  timestamp: z.number(),
  correlationId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional()
});

export type MessageHeader = z.infer<typeof MessageHeaderSchema>;

export const BaseMessageSchema = z.object({
  header: MessageHeaderSchema,
  payload: z.unknown()
});

export type BaseMessage = z.infer<typeof BaseMessageSchema>;

export const ConnectPayloadSchema = z.object({
  clientInfo: ClientInfoSchema,
  authToken: z.string().optional(),
  reconnectToken: z.string().optional()
});

export type ConnectPayload = z.infer<typeof ConnectPayloadSchema>;

export const HeartbeatPayloadSchema = z.object({
  clientTimestamp: z.number(),
  serverTimestamp: z.number().optional(),
  latency: z.number().optional()
});

export type HeartbeatPayload = z.infer<typeof HeartbeatPayloadSchema>;

export const StateSyncPayloadSchema = z.object({
  stateId: z.string(),
  version: z.number(),
  fullState: z.boolean(),
  data: z.unknown(),
  checksum: z.string().optional()
});

export type StateSyncPayload = z.infer<typeof StateSyncPayloadSchema>;

export const StateUpdatePayloadSchema = z.object({
  stateId: z.string(),
  version: z.number(),
  delta: z.unknown(),
  operations: z.array(z.object({
    op: z.enum(['add', 'remove', 'replace', 'move', 'copy']),
    path: z.string(),
    value: z.unknown().optional(),
    from: z.string().optional()
  }))
});

export type StateUpdatePayload = z.infer<typeof StateUpdatePayloadSchema>;

export const AssetRequestPayloadSchema = z.object({
  assetId: z.string(),
  assetType: z.enum(['texture', 'mesh', 'animation', 'audio', 'blueprint', 'level', 'material', 'other']),
  priority: z.number().min(0).max(10).default(5),
  chunkSize: z.number().optional(),
  resumeFrom: z.number().optional()
});

export type AssetRequestPayload = z.infer<typeof AssetRequestPayloadSchema>;

export const AssetChunkPayloadSchema = z.object({
  assetId: z.string(),
  chunkIndex: z.number(),
  totalChunks: z.number(),
  data: z.string(),
  checksum: z.string(),
  bytesTotal: z.number(),
  bytesTransferred: z.number()
});

export type AssetChunkPayload = z.infer<typeof AssetChunkPayloadSchema>;

export const RPCRequestPayloadSchema = z.object({
  method: z.string(),
  params: z.record(z.unknown()).optional(),
  timeout: z.number().optional()
});

export type RPCRequestPayload = z.infer<typeof RPCRequestPayloadSchema>;

export const RPCResponsePayloadSchema = z.object({
  success: z.boolean(),
  result: z.unknown().optional(),
  error: z.object({
    code: z.number(),
    message: z.string(),
    details: z.unknown().optional()
  }).optional()
});

export type RPCResponsePayload = z.infer<typeof RPCResponsePayloadSchema>;

export const EventPayloadSchema = z.object({
  eventType: z.string(),
  eventData: z.unknown(),
  broadcast: z.boolean().default(false),
  targetClients: z.array(z.string().uuid()).optional()
});

export type EventPayload = z.infer<typeof EventPayloadSchema>;

export const ErrorPayloadSchema = z.object({
  code: z.number(),
  message: z.string(),
  details: z.unknown().optional(),
  recoverable: z.boolean().default(true)
});

export type ErrorPayload = z.infer<typeof ErrorPayloadSchema>;

export interface UnrealBridgeConfig {
  port: number;
  host: string;
  wsPath: string;
  apiPath: string;
  maxConnections: number;
  heartbeatInterval: number;
  heartbeatTimeout: number;
  reconnectWindow: number;
  maxMessageSize: number;
  enableCompression: boolean;
  enableBinaryProtocol: boolean;
  authRequired: boolean;
  corsOrigins: string[];
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface SessionData {
  sessionId: string;
  clientId: string;
  clientInfo: ClientInfo;
  connectionState: ConnectionState;
  connectedAt: number;
  lastHeartbeat: number;
  latency: number;
  reconnectToken: string;
  metadata: Record<string, unknown>;
}

export interface AssetManifest {
  assetId: string;
  assetType: string;
  fileName: string;
  fileSize: number;
  checksum: string;
  chunkSize: number;
  totalChunks: number;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface StateSnapshot {
  stateId: string;
  version: number;
  data: unknown;
  checksum: string;
  createdAt: number;
  expiresAt: number;
}

export interface RPCMethod {
  name: string;
  handler: (params: Record<string, unknown>, context: RPCContext) => Promise<unknown>;
  schema?: z.ZodSchema;
  timeout?: number;
  requiresAuth?: boolean;
}

export interface RPCContext {
  clientId: string;
  sessionId: string;
  clientInfo: ClientInfo;
  metadata: Record<string, unknown>;
}

export interface PluginInterface {
  name: string;
  version: string;
  initialize: () => Promise<void>;
  shutdown: () => Promise<void>;
  onConnect?: (session: SessionData) => Promise<void>;
  onDisconnect?: (session: SessionData) => Promise<void>;
  onMessage?: (message: BaseMessage, session: SessionData) => Promise<void>;
  registerRPCMethods?: () => RPCMethod[];
}

export type EventHandler<T = unknown> = (data: T, context: EventContext) => void | Promise<void>;

export interface EventContext {
  clientId?: string;
  sessionId?: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface BridgeMetrics {
  activeConnections: number;
  totalConnections: number;
  messagesReceived: number;
  messagesSent: number;
  bytesReceived: number;
  bytesSent: number;
  averageLatency: number;
  errorCount: number;
  uptime: number;
}
