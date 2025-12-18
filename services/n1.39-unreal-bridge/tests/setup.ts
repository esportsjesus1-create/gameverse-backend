import pino from 'pino';

export const testLogger = pino({
  level: 'silent'
});

export function createMockWebSocket(): {
  send: jest.Mock;
  close: jest.Mock;
  terminate: jest.Mock;
  ping: jest.Mock;
  readyState: number;
  on: jest.Mock;
  off: jest.Mock;
} {
  return {
    send: jest.fn(),
    close: jest.fn(),
    terminate: jest.fn(),
    ping: jest.fn(),
    readyState: 1,
    on: jest.fn(),
    off: jest.fn()
  };
}

export function createMockClientInfo() {
  return {
    clientId: '550e8400-e29b-41d4-a716-446655440000',
    sessionId: '550e8400-e29b-41d4-a716-446655440001',
    unrealVersion: '5.3.0',
    platform: 'Windows' as const,
    buildVersion: '1.0.0',
    metadata: {}
  };
}

export function createMockSessionData() {
  const clientInfo = createMockClientInfo();
  return {
    sessionId: '550e8400-e29b-41d4-a716-446655440001',
    clientId: clientInfo.clientId,
    clientInfo,
    connectionState: 'CONNECTED' as const,
    connectedAt: Date.now(),
    lastHeartbeat: Date.now(),
    latency: 50,
    reconnectToken: '550e8400-e29b-41d4-a716-446655440002',
    metadata: {}
  };
}

beforeAll(() => {
  jest.useFakeTimers({ advanceTimers: true });
});

afterAll(() => {
  jest.useRealTimers();
});

afterEach(() => {
  jest.clearAllMocks();
});
