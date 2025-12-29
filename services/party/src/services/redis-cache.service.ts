import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisCacheService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;
  private readonly PARTY_TTL = 900;
  private readonly PARTY_PREFIX = 'party:';
  private readonly MEMBER_PREFIX = 'party:member:';
  private readonly USER_PARTY_PREFIX = 'user:party:';
  private readonly INVITE_PREFIX = 'party:invite:';
  private readonly MATCHMAKING_PREFIX = 'party:matchmaking:';

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    this.client = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD'),
      db: this.configService.get<number>('REDIS_DB', 0),
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  async setParty(partyId: string, data: Record<string, unknown>): Promise<void> {
    const key = `${this.PARTY_PREFIX}${partyId}`;
    await this.client.setex(key, this.PARTY_TTL, JSON.stringify(data));
  }

  async getParty(partyId: string): Promise<Record<string, unknown> | null> {
    const key = `${this.PARTY_PREFIX}${partyId}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async deleteParty(partyId: string): Promise<void> {
    const key = `${this.PARTY_PREFIX}${partyId}`;
    await this.client.del(key);
  }

  async refreshPartyTTL(partyId: string): Promise<void> {
    const key = `${this.PARTY_PREFIX}${partyId}`;
    await this.client.expire(key, this.PARTY_TTL);
  }

  async setPartyMembers(partyId: string, members: Array<Record<string, unknown>>): Promise<void> {
    const key = `${this.MEMBER_PREFIX}${partyId}`;
    await this.client.setex(key, this.PARTY_TTL, JSON.stringify(members));
  }

  async getPartyMembers(partyId: string): Promise<Array<Record<string, unknown>> | null> {
    const key = `${this.MEMBER_PREFIX}${partyId}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async addPartyMember(partyId: string, member: Record<string, unknown>): Promise<void> {
    const members = await this.getPartyMembers(partyId) || [];
    members.push(member);
    await this.setPartyMembers(partyId, members);
  }

  async removePartyMember(partyId: string, userId: string): Promise<void> {
    const members = await this.getPartyMembers(partyId);
    if (members) {
      const filtered = members.filter((m) => m.userId !== userId);
      await this.setPartyMembers(partyId, filtered);
    }
  }

  async updatePartyMember(partyId: string, userId: string, updates: Record<string, unknown>): Promise<void> {
    const members = await this.getPartyMembers(partyId);
    if (members) {
      const updated = members.map((m) => 
        m.userId === userId ? { ...m, ...updates } : m
      );
      await this.setPartyMembers(partyId, updated);
    }
  }

  async setUserParty(userId: string, partyId: string): Promise<void> {
    const key = `${this.USER_PARTY_PREFIX}${userId}`;
    await this.client.setex(key, this.PARTY_TTL, partyId);
  }

  async getUserParty(userId: string): Promise<string | null> {
    const key = `${this.USER_PARTY_PREFIX}${userId}`;
    return this.client.get(key);
  }

  async deleteUserParty(userId: string): Promise<void> {
    const key = `${this.USER_PARTY_PREFIX}${userId}`;
    await this.client.del(key);
  }

  async setInvite(inviteId: string, data: Record<string, unknown>, ttlSeconds: number): Promise<void> {
    const key = `${this.INVITE_PREFIX}${inviteId}`;
    await this.client.setex(key, ttlSeconds, JSON.stringify(data));
  }

  async getInvite(inviteId: string): Promise<Record<string, unknown> | null> {
    const key = `${this.INVITE_PREFIX}${inviteId}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async deleteInvite(inviteId: string): Promise<void> {
    const key = `${this.INVITE_PREFIX}${inviteId}`;
    await this.client.del(key);
  }

  async setMatchmakingTicket(partyId: string, ticket: Record<string, unknown>): Promise<void> {
    const key = `${this.MATCHMAKING_PREFIX}${partyId}`;
    await this.client.setex(key, 600, JSON.stringify(ticket));
  }

  async getMatchmakingTicket(partyId: string): Promise<Record<string, unknown> | null> {
    const key = `${this.MATCHMAKING_PREFIX}${partyId}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async deleteMatchmakingTicket(partyId: string): Promise<void> {
    const key = `${this.MATCHMAKING_PREFIX}${partyId}`;
    await this.client.del(key);
  }

  async setReadyCheck(partyId: string, data: Record<string, unknown>, ttlSeconds: number): Promise<void> {
    const key = `party:readycheck:${partyId}`;
    await this.client.setex(key, ttlSeconds, JSON.stringify(data));
  }

  async getReadyCheck(partyId: string): Promise<Record<string, unknown> | null> {
    const key = `party:readycheck:${partyId}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async deleteReadyCheck(partyId: string): Promise<void> {
    const key = `party:readycheck:${partyId}`;
    await this.client.del(key);
  }

  async updateReadyCheckResponse(partyId: string, odId: string, ready: boolean): Promise<void> {
    const readyCheck = await this.getReadyCheck(partyId);
    if (readyCheck && readyCheck.responses) {
      (readyCheck.responses as Record<string, boolean>)[odId] = ready;
      const ttl = await this.client.ttl(`party:readycheck:${partyId}`);
      if (ttl > 0) {
        await this.setReadyCheck(partyId, readyCheck, ttl);
      }
    }
  }

  async publishEvent(channel: string, event: Record<string, unknown>): Promise<void> {
    await this.client.publish(channel, JSON.stringify(event));
  }

  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    const subscriber = this.client.duplicate();
    await subscriber.subscribe(channel);
    subscriber.on('message', (ch, message) => {
      if (ch === channel) {
        callback(message);
      }
    });
  }

  async incrementCounter(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async setWithExpiry(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.client.setex(key, ttlSeconds, value);
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }
}
