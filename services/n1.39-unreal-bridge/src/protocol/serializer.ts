import * as msgpack from 'msgpack-lite';
import { BaseMessage, MessageHeader, MessageType } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { calculateChecksum } from '../utils/checksum';

export interface SerializerOptions {
  useBinary: boolean;
  includeChecksum: boolean;
}

const PROTOCOL_VERSION = 1;
const MAGIC_BYTES = Buffer.from([0x55, 0x45, 0x42, 0x52]); // "UEBR" - Unreal Engine Bridge

export class MessageSerializer {
  private readonly options: SerializerOptions;

  constructor(options: Partial<SerializerOptions> = {}) {
    this.options = {
      useBinary: options.useBinary ?? true,
      includeChecksum: options.includeChecksum ?? true
    };
  }

  createMessage(type: MessageType, payload: unknown, correlationId?: string): BaseMessage {
    const header: MessageHeader = {
      id: uuidv4(),
      type,
      timestamp: Date.now(),
      correlationId
    };

    return { header, payload };
  }

  serialize(message: BaseMessage): Buffer | string {
    if (this.options.useBinary) {
      return this.serializeBinary(message);
    }
    return this.serializeJSON(message);
  }

  deserialize(data: Buffer | string): BaseMessage {
    if (Buffer.isBuffer(data) && this.isBinaryMessage(data)) {
      return this.deserializeBinary(data);
    }
    return this.deserializeJSON(typeof data === 'string' ? data : data.toString('utf-8'));
  }

  private serializeBinary(message: BaseMessage): Buffer {
    const payload = msgpack.encode(message);
    const checksum = this.options.includeChecksum ? calculateChecksum(payload) : '';
    
    const header = Buffer.alloc(12);
    MAGIC_BYTES.copy(header, 0);
    header.writeUInt8(PROTOCOL_VERSION, 4);
    header.writeUInt8(this.options.includeChecksum ? 1 : 0, 5);
    header.writeUInt32BE(payload.length, 6);
    header.writeUInt16BE(checksum.length, 10);

    const checksumBuffer = Buffer.from(checksum, 'utf-8');
    return Buffer.concat([header, checksumBuffer, payload]);
  }

  private deserializeBinary(data: Buffer): BaseMessage {
    if (data.length < 12) {
      throw new Error('Invalid binary message: too short');
    }

    const magic = data.subarray(0, 4);
    if (!magic.equals(MAGIC_BYTES)) {
      throw new Error('Invalid binary message: magic bytes mismatch');
    }

    const version = data.readUInt8(4);
    if (version !== PROTOCOL_VERSION) {
      throw new Error(`Unsupported protocol version: ${version}`);
    }

    const hasChecksum = data.readUInt8(5) === 1;
    const payloadLength = data.readUInt32BE(6);
    const checksumLength = data.readUInt16BE(10);

    const checksumStart = 12;
    const payloadStart = checksumStart + checksumLength;

    if (hasChecksum && checksumLength > 0) {
      const expectedChecksum = data.subarray(checksumStart, payloadStart).toString('utf-8');
      const payload = data.subarray(payloadStart, payloadStart + payloadLength);
      const actualChecksum = calculateChecksum(payload);

      if (expectedChecksum !== actualChecksum) {
        throw new Error('Checksum verification failed');
      }
    }

    const payload = data.subarray(payloadStart, payloadStart + payloadLength);
    return msgpack.decode(payload) as BaseMessage;
  }

  private serializeJSON(message: BaseMessage): string {
    const json = JSON.stringify(message);
    if (this.options.includeChecksum) {
      const checksum = calculateChecksum(json);
      return JSON.stringify({ data: message, checksum });
    }
    return json;
  }

  private deserializeJSON(data: string): BaseMessage {
    const parsed = JSON.parse(data);
    
    if (parsed.checksum && parsed.data) {
      const expectedChecksum = parsed.checksum;
      const actualChecksum = calculateChecksum(JSON.stringify(parsed.data));
      
      if (expectedChecksum !== actualChecksum) {
        throw new Error('Checksum verification failed');
      }
      
      return parsed.data as BaseMessage;
    }
    
    return parsed as BaseMessage;
  }

  private isBinaryMessage(data: Buffer): boolean {
    return data.length >= 4 && data.subarray(0, 4).equals(MAGIC_BYTES);
  }
}

export const defaultSerializer = new MessageSerializer();
