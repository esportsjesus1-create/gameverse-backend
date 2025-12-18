import { createHash } from 'crypto';

export function calculateChecksum(data: Buffer | string): string {
  const hash = createHash('sha256');
  hash.update(typeof data === 'string' ? Buffer.from(data) : data);
  return hash.digest('hex');
}

export function verifyChecksum(data: Buffer | string, expectedChecksum: string): boolean {
  const actualChecksum = calculateChecksum(data);
  return actualChecksum === expectedChecksum;
}

export function calculateCRC32(data: Buffer | string): number {
  const buffer = typeof data === 'string' ? Buffer.from(data) : data;
  let crc = 0xFFFFFFFF;
  
  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

export function generateStateChecksum(state: unknown): string {
  const serialized = JSON.stringify(state, Object.keys(state as object).sort());
  return calculateChecksum(serialized);
}
