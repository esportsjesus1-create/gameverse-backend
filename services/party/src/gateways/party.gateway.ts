import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { PartyService } from '../services/party.service';
import { PartyMemberService } from '../services/party-member.service';
import { PartyInviteService } from '../services/party-invite.service';
import { PartyChatService } from '../services/party-chat.service';
import { PartyMatchmakingService } from '../services/party-matchmaking.service';
import { RedisCacheService } from '../services/redis-cache.service';
import { GamerstakeService } from '../services/gamerstake.service';
import { PartyEventType } from '../interfaces/party-events.interface';
import { MemberStatus, ReadyStatus } from '../entities/party-member.entity';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
  partyId?: string;
}

@WebSocketGateway({
  namespace: '/party',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class PartyGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(PartyGateway.name);
  private userSockets: Map<string, Set<string>> = new Map();

  constructor(
    private partyService: PartyService,
    private memberService: PartyMemberService,
    private inviteService: PartyInviteService,
    private chatService: PartyChatService,
    private matchmakingService: PartyMatchmakingService,
    private cacheService: RedisCacheService,
    private gamerstakeService: GamerstakeService,
  ) {}

  afterInit() {
    this.logger.log('Party WebSocket Gateway initialized');
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = client.handshake.auth.token || client.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        client.disconnect();
        return;
      }

      const user = await this.gamerstakeService.validateToken(token);
      if (!user) {
        client.disconnect();
        return;
      }

      client.userId = user.id;
      client.username = user.username;

      if (!this.userSockets.has(user.id)) {
        this.userSockets.set(user.id, new Set());
      }
      this.userSockets.get(user.id)?.add(client.id);

      client.join(`user:${user.id}`);

      const party = await this.partyService.getUserActiveParty(user.id);
      if (party) {
        client.partyId = party.id;
        client.join(`party:${party.id}`);
        await this.memberService.setMemberStatus(party.id, user.id, MemberStatus.ACTIVE);
      }

      this.logger.log(`Client connected: ${client.id}, User: ${user.id}`);
    } catch (error) {
      this.logger.error(`Connection error: ${error}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      this.userSockets.get(client.userId)?.delete(client.id);

      if (this.userSockets.get(client.userId)?.size === 0) {
        this.userSockets.delete(client.userId);

        if (client.partyId) {
          await this.memberService.setMemberStatus(client.partyId, client.userId, MemberStatus.OFFLINE);
          this.emitToParty(client.partyId, PartyEventType.MEMBER_STATUS_CHANGED, {
            userId: client.userId,
            status: MemberStatus.OFFLINE,
          });
        }
      }
    }

    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinPartyRoom')
  async handleJoinPartyRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { partyId: string },
  ) {
    if (!client.userId) return;

    const isMember = await this.partyService.isMember(data.partyId, client.userId);
    if (!isMember) {
      return { error: 'Not a member of this party' };
    }

    if (client.partyId) {
      client.leave(`party:${client.partyId}`);
    }

    client.partyId = data.partyId;
    client.join(`party:${data.partyId}`);

    await this.memberService.setMemberStatus(data.partyId, client.userId, MemberStatus.ACTIVE);

    this.emitToParty(data.partyId, PartyEventType.MEMBER_STATUS_CHANGED, {
      userId: client.userId,
      username: client.username,
      status: MemberStatus.ACTIVE,
    });

    return { success: true };
  }

  @SubscribeMessage('leavePartyRoom')
  async handleLeavePartyRoom(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!client.userId || !client.partyId) return;

    client.leave(`party:${client.partyId}`);

    this.emitToParty(client.partyId, PartyEventType.MEMBER_STATUS_CHANGED, {
      userId: client.userId,
      status: MemberStatus.AWAY,
    });

    client.partyId = undefined;

    return { success: true };
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { content: string; type?: string; replyToId?: string; mentions?: string[] },
  ) {
    if (!client.userId || !client.partyId) {
      return { error: 'Not in a party' };
    }

    try {
      const message = await this.chatService.sendMessage(client.partyId, client.userId, {
        content: data.content,
        type: data.type as never,
        replyToId: data.replyToId,
        mentions: data.mentions,
      });

      this.emitToParty(client.partyId, PartyEventType.CHAT_MESSAGE, {
        message: {
          id: message.id,
          senderId: message.senderId,
          senderUsername: message.senderUsername,
          content: message.content,
          type: message.type,
          createdAt: message.createdAt,
          replyToId: message.replyToId,
        },
      });

      return { success: true, messageId: message.id };
    } catch (error) {
      return { error: (error as Error).message };
    }
  }

  @SubscribeMessage('typing')
  async handleTyping(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!client.userId || !client.partyId) return;

    this.emitToParty(client.partyId, PartyEventType.CHAT_TYPING, {
      userId: client.userId,
      username: client.username,
    }, client.id);
  }

  @SubscribeMessage('setReadyStatus')
  async handleSetReadyStatus(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { ready: boolean },
  ) {
    if (!client.userId || !client.partyId) {
      return { error: 'Not in a party' };
    }

    try {
      const readyStatus = data.ready ? ReadyStatus.READY : ReadyStatus.NOT_READY;
      await this.memberService.setReadyStatus(client.partyId, client.userId, { readyStatus });

      this.emitToParty(client.partyId, PartyEventType.MEMBER_READY_CHANGED, {
        userId: client.userId,
        username: client.username,
        readyStatus,
      });

      const allReady = await this.memberService.isAllReady(client.partyId);
      if (allReady) {
        this.emitToParty(client.partyId, 'allReady', { allReady: true });
      }

      return { success: true };
    } catch (error) {
      return { error: (error as Error).message };
    }
  }

  @SubscribeMessage('setStatus')
  async handleSetStatus(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { status: MemberStatus },
  ) {
    if (!client.userId || !client.partyId) {
      return { error: 'Not in a party' };
    }

    try {
      await this.memberService.setMemberStatus(client.partyId, client.userId, data.status);

      this.emitToParty(client.partyId, PartyEventType.MEMBER_STATUS_CHANGED, {
        userId: client.userId,
        username: client.username,
        status: data.status,
      });

      return { success: true };
    } catch (error) {
      return { error: (error as Error).message };
    }
  }

  @SubscribeMessage('readyCheckResponse')
  async handleReadyCheckResponse(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { ready: boolean },
  ) {
    if (!client.userId || !client.partyId) {
      return { error: 'Not in a party' };
    }

    try {
      const result = await this.matchmakingService.respondToReadyCheck(
        client.partyId,
        client.userId,
        { ready: data.ready },
      );

      this.emitToParty(client.partyId, PartyEventType.READY_CHECK_RESPONSE, {
        userId: client.userId,
        username: client.username,
        ready: data.ready,
        responses: result.responses,
        completed: result.completed,
      });

      return { success: true };
    } catch (error) {
      return { error: (error as Error).message };
    }
  }

  @SubscribeMessage('addReaction')
  async handleAddReaction(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { messageId: string; reaction: string },
  ) {
    if (!client.userId || !client.partyId) {
      return { error: 'Not in a party' };
    }

    try {
      await this.chatService.addReaction(data.messageId, client.userId, { reaction: data.reaction });

      this.emitToParty(client.partyId, PartyEventType.CHAT_REACTION_ADDED, {
        messageId: data.messageId,
        userId: client.userId,
        reaction: data.reaction,
      });

      return { success: true };
    } catch (error) {
      return { error: (error as Error).message };
    }
  }

  @SubscribeMessage('removeReaction')
  async handleRemoveReaction(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { messageId: string; reaction: string },
  ) {
    if (!client.userId || !client.partyId) {
      return { error: 'Not in a party' };
    }

    try {
      await this.chatService.removeReaction(data.messageId, client.userId, data.reaction);

      this.emitToParty(client.partyId, PartyEventType.CHAT_REACTION_REMOVED, {
        messageId: data.messageId,
        userId: client.userId,
        reaction: data.reaction,
      });

      return { success: true };
    } catch (error) {
      return { error: (error as Error).message };
    }
  }

  @SubscribeMessage('setMuted')
  async handleSetMuted(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { muted: boolean },
  ) {
    if (!client.userId || !client.partyId) {
      return { error: 'Not in a party' };
    }

    try {
      await this.memberService.setMuted(client.partyId, client.userId, data.muted);

      this.emitToParty(client.partyId, data.muted ? PartyEventType.VOICE_USER_MUTED : PartyEventType.VOICE_USER_UNMUTED, {
        userId: client.userId,
        username: client.username,
      });

      return { success: true };
    } catch (error) {
      return { error: (error as Error).message };
    }
  }

  @SubscribeMessage('setDeafened')
  async handleSetDeafened(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { deafened: boolean },
  ) {
    if (!client.userId || !client.partyId) {
      return { error: 'Not in a party' };
    }

    try {
      await this.memberService.setDeafened(client.partyId, client.userId, data.deafened);

      this.emitToParty(client.partyId, data.deafened ? PartyEventType.VOICE_USER_DEAFENED : PartyEventType.VOICE_USER_UNDEAFENED, {
        userId: client.userId,
        username: client.username,
      });

      return { success: true };
    } catch (error) {
      return { error: (error as Error).message };
    }
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: AuthenticatedSocket) {
    if (client.userId && client.partyId) {
      this.memberService.updateLastActive(client.partyId, client.userId);
    }
    return { pong: Date.now() };
  }

  emitToParty(partyId: string, event: string, data: unknown, excludeSocketId?: string) {
    if (excludeSocketId) {
      this.server.to(`party:${partyId}`).except(excludeSocketId).emit(event, data);
    } else {
      this.server.to(`party:${partyId}`).emit(event, data);
    }
  }

  emitToUser(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  async notifyPartyCreated(partyId: string, party: unknown) {
    this.emitToParty(partyId, PartyEventType.PARTY_CREATED, { party });
  }

  async notifyPartyUpdated(partyId: string, updates: unknown) {
    this.emitToParty(partyId, PartyEventType.PARTY_UPDATED, { updates });
  }

  async notifyPartyDisbanded(partyId: string) {
    this.emitToParty(partyId, PartyEventType.PARTY_DISBANDED, { partyId });
  }

  async notifyMemberJoined(partyId: string, member: unknown) {
    this.emitToParty(partyId, PartyEventType.MEMBER_JOINED, { member });
  }

  async notifyMemberLeft(partyId: string, userId: string, username: string, reason: string) {
    this.emitToParty(partyId, PartyEventType.MEMBER_LEFT, { userId, username, reason });
  }

  async notifyMemberKicked(partyId: string, userId: string, username: string, reason?: string) {
    this.emitToParty(partyId, PartyEventType.MEMBER_KICKED, { userId, username, reason });
    this.emitToUser(userId, PartyEventType.MEMBER_KICKED, { partyId, reason });
  }

  async notifyLeaderChanged(partyId: string, newLeaderId: string, newLeaderUsername: string) {
    this.emitToParty(partyId, PartyEventType.LEADER_CHANGED, {
      newLeaderId,
      newLeaderUsername,
    });
  }

  async notifyInviteSent(partyId: string, invite: unknown) {
    this.emitToParty(partyId, PartyEventType.INVITE_SENT, { invite });
  }

  async notifyInviteReceived(userId: string, invite: unknown) {
    this.emitToUser(userId, PartyEventType.INVITE_RECEIVED, { invite });
  }

  async notifyMatchmakingStarted(partyId: string, ticket: unknown) {
    this.emitToParty(partyId, PartyEventType.MATCHMAKING_STARTED, { ticket });
  }

  async notifyMatchmakingCancelled(partyId: string, reason?: string) {
    this.emitToParty(partyId, PartyEventType.MATCHMAKING_CANCELLED, { reason });
  }

  async notifyMatchmakingProgress(partyId: string, progress: unknown) {
    this.emitToParty(partyId, PartyEventType.MATCHMAKING_PROGRESS, progress);
  }

  async notifyMatchFound(partyId: string, matchData: unknown) {
    this.emitToParty(partyId, PartyEventType.MATCHMAKING_FOUND, matchData);
  }

  async notifyReadyCheckStarted(partyId: string, readyCheck: unknown) {
    this.emitToParty(partyId, PartyEventType.READY_CHECK_STARTED, readyCheck);
  }

  async notifySettingsUpdated(partyId: string, settings: unknown) {
    this.emitToParty(partyId, PartyEventType.SETTINGS_UPDATED, { settings });
  }

  isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId) && (this.userSockets.get(userId)?.size || 0) > 0;
  }

  getOnlineUsersInParty(partyId: string): string[] {
    const room = this.server.sockets.adapter.rooms.get(`party:${partyId}`);
    if (!room) return [];

    const onlineUsers: string[] = [];
    for (const socketId of room) {
      const socket = this.server.sockets.sockets.get(socketId) as AuthenticatedSocket;
      if (socket?.userId) {
        onlineUsers.push(socket.userId);
      }
    }
    return [...new Set(onlineUsers)];
  }
}
