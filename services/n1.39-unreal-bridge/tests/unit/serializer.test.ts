import { MessageSerializer } from '../../src/protocol/serializer';
import { BaseMessage, MessageType } from '../../src/types';

describe('MessageSerializer', () => {
  describe('JSON serialization', () => {
    let serializer: MessageSerializer;

    beforeEach(() => {
      serializer = new MessageSerializer({
        useBinary: false,
        includeChecksum: true
      });
    });

    it('should create a message with correct structure', () => {
      const message = serializer.createMessage('CONNECT', { test: 'data' });

      expect(message.header).toBeDefined();
      expect(message.header.id).toBeDefined();
      expect(message.header.type).toBe('CONNECT');
      expect(message.header.timestamp).toBeDefined();
      expect(message.payload).toEqual({ test: 'data' });
    });

    it('should create a message with correlation ID', () => {
      const correlationId = '550e8400-e29b-41d4-a716-446655440000';
      const message = serializer.createMessage('ACK', { success: true }, correlationId);

      expect(message.header.correlationId).toBe(correlationId);
    });

    it('should serialize and deserialize JSON message with checksum', () => {
      const original = serializer.createMessage('HEARTBEAT', { timestamp: Date.now() });
      const serialized = serializer.serialize(original);
      const deserialized = serializer.deserialize(serialized);

      expect(deserialized.header.type).toBe(original.header.type);
      expect(deserialized.payload).toEqual(original.payload);
    });

    it('should throw error on checksum mismatch', () => {
      const original = serializer.createMessage('EVENT', { data: 'test' });
      const serialized = serializer.serialize(original) as string;
      
      const parsed = JSON.parse(serialized);
      parsed.checksum = 'invalid-checksum';
      const tampered = JSON.stringify(parsed);

      expect(() => serializer.deserialize(tampered)).toThrow('Checksum verification failed');
    });
  });

  describe('JSON serialization without checksum', () => {
    let serializer: MessageSerializer;

    beforeEach(() => {
      serializer = new MessageSerializer({
        useBinary: false,
        includeChecksum: false
      });
    });

    it('should serialize and deserialize without checksum', () => {
      const original = serializer.createMessage('STATE_SYNC', { stateId: 'test' });
      const serialized = serializer.serialize(original);
      const deserialized = serializer.deserialize(serialized);

      expect(deserialized.header.type).toBe(original.header.type);
      expect(deserialized.payload).toEqual(original.payload);
    });
  });

  describe('Binary serialization', () => {
    let serializer: MessageSerializer;

    beforeEach(() => {
      serializer = new MessageSerializer({
        useBinary: true,
        includeChecksum: true
      });
    });

    it('should serialize to binary format', () => {
      const message = serializer.createMessage('CONNECT', { test: 'data' });
      const serialized = serializer.serialize(message);

      expect(Buffer.isBuffer(serialized)).toBe(true);
    });

    it('should serialize and deserialize binary message', () => {
      const original = serializer.createMessage('RPC_REQUEST', { method: 'test' });
      const serialized = serializer.serialize(original);
      const deserialized = serializer.deserialize(serialized);

      expect(deserialized.header.type).toBe(original.header.type);
      expect(deserialized.payload).toEqual(original.payload);
    });

    it('should include magic bytes in binary format', () => {
      const message = serializer.createMessage('HEARTBEAT', {});
      const serialized = serializer.serialize(message) as Buffer;

      expect(serialized[0]).toBe(0x55);
      expect(serialized[1]).toBe(0x45);
      expect(serialized[2]).toBe(0x42);
      expect(serialized[3]).toBe(0x52);
    });

    it('should throw error for invalid magic bytes', () => {
      const invalidBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);

      expect(() => serializer.deserialize(invalidBuffer)).toThrow();
    });

    it('should throw error for unsupported protocol version', () => {
      const invalidBuffer = Buffer.from([0x55, 0x45, 0x42, 0x52, 0xFF, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);

      expect(() => serializer.deserialize(invalidBuffer)).toThrow('Unsupported protocol version');
    });

    it('should throw error for too short binary message', () => {
      const shortBuffer = Buffer.from([0x55, 0x45, 0x42, 0x52]);

      expect(() => serializer.deserialize(shortBuffer)).toThrow('Invalid binary message: too short');
    });
  });

  describe('Binary serialization without checksum', () => {
    let serializer: MessageSerializer;

    beforeEach(() => {
      serializer = new MessageSerializer({
        useBinary: true,
        includeChecksum: false
      });
    });

    it('should serialize and deserialize without checksum', () => {
      const original = serializer.createMessage('EVENT', { eventType: 'test' });
      const serialized = serializer.serialize(original);
      const deserialized = serializer.deserialize(serialized);

      expect(deserialized.header.type).toBe(original.header.type);
    });
  });

  describe('Message types', () => {
    let serializer: MessageSerializer;

    beforeEach(() => {
      serializer = new MessageSerializer({ useBinary: false, includeChecksum: false });
    });

    const messageTypes: MessageType[] = [
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
    ];

    messageTypes.forEach((type) => {
      it(`should handle ${type} message type`, () => {
        const message = serializer.createMessage(type, { test: true });
        expect(message.header.type).toBe(type);
      });
    });
  });
});
