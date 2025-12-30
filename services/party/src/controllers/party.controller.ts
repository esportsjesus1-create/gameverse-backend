import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { PartyService } from '../services/party.service';
import { PartyMemberService } from '../services/party-member.service';
import { PartyInviteService } from '../services/party-invite.service';
import { PartyChatService } from '../services/party-chat.service';
import { PartySettingsService } from '../services/party-settings.service';
import { PartyMatchmakingService } from '../services/party-matchmaking.service';
import { PartyGateway } from '../gateways/party.gateway';
import {
  CreatePartyDto,
  UpdatePartyDto,
  AddMemberDto,
  UpdateMemberDto,
  TransferLeadershipDto,
  KickMemberDto,
  SetReadyStatusDto,
  UpdateMemberPermissionsDto,
  CreateInviteDto,
  RespondToInviteDto,
  JoinByCodeDto,
  JoinByTokenDto,
  BulkInviteDto,
  SendMessageDto,
  EditMessageDto,
  AddReactionDto,
  GetMessagesQueryDto,
  MarkAsReadDto,
  UpdatePartySettingsDto,
  StartMatchmakingDto,
  CancelMatchmakingDto,
  ReadyCheckDto,
  ReadyCheckResponseDto,
} from '../dto';
import { PartyVisibility } from '../entities/party.entity';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user: { id: string; username: string };
}

@ApiTags('Party')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('parties')
export class PartyController {
  constructor(
    private partyService: PartyService,
    private memberService: PartyMemberService,
    private inviteService: PartyInviteService,
    private chatService: PartyChatService,
    private settingsService: PartySettingsService,
    private matchmakingService: PartyMatchmakingService,
    private partyGateway: PartyGateway,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new party (FR-1.1)' })
  @ApiResponse({ status: 201, description: 'Party created successfully' })
  async createParty(@Request() req: AuthenticatedRequest, @Body() dto: CreatePartyDto) {
    const party = await this.partyService.create(req.user.id, dto);
    await this.partyGateway.notifyPartyCreated(party.id, party);
    return party;
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user active party (FR-1.2)' })
  @ApiResponse({ status: 200, description: 'Returns user active party or null' })
  async getMyParty(@Request() req: AuthenticatedRequest) {
    return this.partyService.getUserActiveParty(req.user.id);
  }

  @Get('public')
  @ApiOperation({ summary: 'Get public parties (FR-1.3)' })
  @ApiQuery({ name: 'gameId', required: false })
  @ApiQuery({ name: 'region', required: false })
  @ApiQuery({ name: 'minRank', required: false, type: Number })
  @ApiQuery({ name: 'maxRank', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async getPublicParties(
    @Query('gameId') gameId?: string,
    @Query('region') region?: string,
    @Query('minRank') minRank?: number,
    @Query('maxRank') maxRank?: number,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.partyService.getPublicParties({
      gameId,
      region,
      minRank,
      maxRank,
      limit,
      offset,
    });
  }

  @Get('search')
  @ApiOperation({ summary: 'Search parties (FR-1.4)' })
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'gameId', required: false })
  @ApiQuery({ name: 'visibility', required: false, enum: PartyVisibility })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async searchParties(
    @Query('q') query: string,
    @Query('gameId') gameId?: string,
    @Query('visibility') visibility?: PartyVisibility,
    @Query('limit') limit?: number,
  ) {
    return this.partyService.searchParties(query, { gameId, visibility, limit });
  }

  @Get('history')
  @ApiOperation({ summary: 'Get user party history (FR-1.5)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getPartyHistory(@Request() req: AuthenticatedRequest, @Query('limit') limit?: number) {
    return this.partyService.getPartyHistory(req.user.id, limit);
  }

  @Get(':partyId')
  @ApiOperation({ summary: 'Get party by ID (FR-1.6)' })
  @ApiParam({ name: 'partyId', type: String })
  async getParty(@Param('partyId') partyId: string) {
    return this.partyService.findById(partyId);
  }

  @Patch(':partyId')
  @ApiOperation({ summary: 'Update party (FR-1.7)' })
  @ApiParam({ name: 'partyId', type: String })
  async updateParty(
    @Request() req: AuthenticatedRequest,
    @Param('partyId') partyId: string,
    @Body() dto: UpdatePartyDto,
  ) {
    const party = await this.partyService.update(partyId, req.user.id, dto);
    await this.partyGateway.notifyPartyUpdated(partyId, dto);
    return party;
  }

  @Delete(':partyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Disband party (FR-1.8)' })
  @ApiParam({ name: 'partyId', type: String })
  async disbandParty(@Request() req: AuthenticatedRequest, @Param('partyId') partyId: string) {
    await this.partyService.disband(partyId, req.user.id);
    await this.partyGateway.notifyPartyDisbanded(partyId);
  }

  @Get(':partyId/stats')
  @ApiOperation({ summary: 'Get party statistics (FR-1.9)' })
  @ApiParam({ name: 'partyId', type: String })
  async getPartyStats(@Param('partyId') partyId: string) {
    return this.partyService.getPartyStats(partyId);
  }

  @Post(':partyId/join-code')
  @ApiOperation({ summary: 'Regenerate join code (FR-1.10)' })
  @ApiParam({ name: 'partyId', type: String })
  async regenerateJoinCode(@Request() req: AuthenticatedRequest, @Param('partyId') partyId: string) {
    const code = await this.partyService.regenerateJoinCode(partyId, req.user.id);
    return { joinCode: code };
  }

  @Delete(':partyId/join-code')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove join code (FR-1.11)' })
  @ApiParam({ name: 'partyId', type: String })
  async removeJoinCode(@Request() req: AuthenticatedRequest, @Param('partyId') partyId: string) {
    await this.partyService.removeJoinCode(partyId, req.user.id);
  }

  @Put(':partyId/game')
  @ApiOperation({ summary: 'Set party game (FR-1.12)' })
  @ApiParam({ name: 'partyId', type: String })
  async setGame(
    @Request() req: AuthenticatedRequest,
    @Param('partyId') partyId: string,
    @Body() body: { gameId: string; gameName: string; gameMode?: string },
  ) {
    const party = await this.partyService.setGame(partyId, req.user.id, body.gameId, body.gameName, body.gameMode);
    await this.partyGateway.notifyPartyUpdated(partyId, { gameId: body.gameId, gameName: body.gameName });
    return party;
  }

  @Put(':partyId/visibility')
  @ApiOperation({ summary: 'Set party visibility (FR-1.13)' })
  @ApiParam({ name: 'partyId', type: String })
  async setVisibility(
    @Request() req: AuthenticatedRequest,
    @Param('partyId') partyId: string,
    @Body() body: { visibility: PartyVisibility },
  ) {
    return this.partyService.setVisibility(partyId, req.user.id, body.visibility);
  }

  @Get(':partyId/members')
  @ApiOperation({ summary: 'Get party members (FR-2.1)' })
  @ApiParam({ name: 'partyId', type: String })
  async getMembers(@Param('partyId') partyId: string) {
    return this.memberService.getMembers(partyId);
  }

  @Post(':partyId/members')
  @ApiOperation({ summary: 'Add member to party (FR-2.2)' })
  @ApiParam({ name: 'partyId', type: String })
  async addMember(@Param('partyId') partyId: string, @Body() dto: AddMemberDto) {
    const member = await this.memberService.addMember(partyId, dto);
    await this.partyGateway.notifyMemberJoined(partyId, member);
    return member;
  }

  @Delete(':partyId/members/me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Leave party (FR-2.3)' })
  @ApiParam({ name: 'partyId', type: String })
  async leaveParty(@Request() req: AuthenticatedRequest, @Param('partyId') partyId: string) {
    await this.memberService.removeMember(partyId, req.user.id, 'left');
    await this.partyGateway.notifyMemberLeft(partyId, req.user.id, req.user.username, 'left');
  }

  @Post(':partyId/members/kick')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Kick member from party (FR-2.4)' })
  @ApiParam({ name: 'partyId', type: String })
  async kickMember(
    @Request() req: AuthenticatedRequest,
    @Param('partyId') partyId: string,
    @Body() dto: KickMemberDto,
  ) {
    const member = await this.memberService.getMember(partyId, dto.userId);
    await this.memberService.kickMember(partyId, req.user.id, dto);
    await this.partyGateway.notifyMemberKicked(partyId, dto.userId, member?.username || '', dto.reason);
  }

  @Patch(':partyId/members/:userId')
  @ApiOperation({ summary: 'Update member (FR-2.5)' })
  @ApiParam({ name: 'partyId', type: String })
  @ApiParam({ name: 'userId', type: String })
  async updateMember(
    @Param('partyId') partyId: string,
    @Param('userId') odId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.memberService.updateMember(partyId, odId, dto);
  }

  @Post(':partyId/transfer-leadership')
  @ApiOperation({ summary: 'Transfer leadership (FR-2.6)' })
  @ApiParam({ name: 'partyId', type: String })
  async transferLeadership(
    @Request() req: AuthenticatedRequest,
    @Param('partyId') partyId: string,
    @Body() dto: TransferLeadershipDto,
  ) {
    await this.memberService.transferLeadership(partyId, req.user.id, dto);
    const newLeader = await this.memberService.getMember(partyId, dto.newLeaderId);
    await this.partyGateway.notifyLeaderChanged(partyId, dto.newLeaderId, newLeader?.username || '');
    return { success: true };
  }

  @Post(':partyId/members/:userId/promote')
  @ApiOperation({ summary: 'Promote to co-leader (FR-2.7)' })
  @ApiParam({ name: 'partyId', type: String })
  @ApiParam({ name: 'userId', type: String })
  async promoteToCoLeader(
    @Request() req: AuthenticatedRequest,
    @Param('partyId') partyId: string,
    @Param('userId') odId: string,
  ) {
    return this.memberService.promoteToCoLeader(partyId, req.user.id, odId);
  }

  @Post(':partyId/members/:userId/demote')
  @ApiOperation({ summary: 'Demote from co-leader (FR-2.8)' })
  @ApiParam({ name: 'partyId', type: String })
  @ApiParam({ name: 'userId', type: String })
  async demoteFromCoLeader(
    @Request() req: AuthenticatedRequest,
    @Param('partyId') partyId: string,
    @Param('userId') odId: string,
  ) {
    return this.memberService.demoteFromCoLeader(partyId, req.user.id, odId);
  }

  @Put(':partyId/members/me/ready')
  @ApiOperation({ summary: 'Set ready status (FR-2.9)' })
  @ApiParam({ name: 'partyId', type: String })
  async setReadyStatus(
    @Request() req: AuthenticatedRequest,
    @Param('partyId') partyId: string,
    @Body() dto: SetReadyStatusDto,
  ) {
    return this.memberService.setReadyStatus(partyId, req.user.id, dto);
  }

  @Put(':partyId/members/:userId/permissions')
  @ApiOperation({ summary: 'Update member permissions (FR-2.10)' })
  @ApiParam({ name: 'partyId', type: String })
  @ApiParam({ name: 'userId', type: String })
  async updatePermissions(
    @Request() req: AuthenticatedRequest,
    @Param('partyId') partyId: string,
    @Body() dto: UpdateMemberPermissionsDto,
  ) {
    return this.memberService.updatePermissions(partyId, req.user.id, dto);
  }

  @Post(':partyId/invites')
  @ApiOperation({ summary: 'Create invite (FR-3.1)' })
  @ApiParam({ name: 'partyId', type: String })
  async createInvite(
    @Request() req: AuthenticatedRequest,
    @Param('partyId') partyId: string,
    @Body() dto: CreateInviteDto,
  ) {
    const invite = await this.inviteService.createInvite(partyId, req.user.id, dto);
    await this.partyGateway.notifyInviteSent(partyId, invite);
    if (dto.inviteeId) {
      await this.partyGateway.notifyInviteReceived(dto.inviteeId, invite);
    }
    return invite;
  }

  @Post(':partyId/invites/bulk')
  @ApiOperation({ summary: 'Create bulk invites (FR-3.2)' })
  @ApiParam({ name: 'partyId', type: String })
  async createBulkInvites(
    @Request() req: AuthenticatedRequest,
    @Param('partyId') partyId: string,
    @Body() dto: BulkInviteDto,
  ) {
    return this.inviteService.createBulkInvites(partyId, req.user.id, dto);
  }

  @Post(':partyId/invites/friends')
  @ApiOperation({ summary: 'Invite all online friends (FR-3.3)' })
  @ApiParam({ name: 'partyId', type: String })
  async inviteFriends(@Request() req: AuthenticatedRequest, @Param('partyId') partyId: string) {
    return this.inviteService.inviteFriends(partyId, req.user.id);
  }

  @Get(':partyId/invites')
  @ApiOperation({ summary: 'Get party invites (FR-3.4)' })
  @ApiParam({ name: 'partyId', type: String })
  async getPartyInvites(@Param('partyId') partyId: string) {
    return this.inviteService.getPartyInvites(partyId);
  }

  @Post(':partyId/invites/link')
  @ApiOperation({ summary: 'Create invite link (FR-3.5)' })
  @ApiParam({ name: 'partyId', type: String })
  async createInviteLink(
    @Request() req: AuthenticatedRequest,
    @Param('partyId') partyId: string,
    @Body() body: { maxUses?: number; expiresInHours?: number },
  ) {
    const token = await this.inviteService.createInviteLink(
      partyId,
      req.user.id,
      body.maxUses,
      body.expiresInHours,
    );
    return { inviteLink: `/join/${token}`, token };
  }

  @Get('invites/pending')
  @ApiOperation({ summary: 'Get user pending invites (FR-3.6)' })
  async getUserPendingInvites(@Request() req: AuthenticatedRequest) {
    return this.inviteService.getUserPendingInvites(req.user.id);
  }

  @Post('invites/:inviteId/respond')
  @ApiOperation({ summary: 'Respond to invite (FR-3.7)' })
  @ApiParam({ name: 'inviteId', type: String })
  async respondToInvite(
    @Request() req: AuthenticatedRequest,
    @Param('inviteId') inviteId: string,
    @Body() dto: RespondToInviteDto,
  ) {
    await this.inviteService.respondToInvite(inviteId, req.user.id, dto);
    return { success: true };
  }

  @Delete('invites/:inviteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel invite (FR-3.8)' })
  @ApiParam({ name: 'inviteId', type: String })
  async cancelInvite(@Request() req: AuthenticatedRequest, @Param('inviteId') inviteId: string) {
    await this.inviteService.cancelInvite(inviteId, req.user.id);
  }

  @Post('join/code')
  @ApiOperation({ summary: 'Join party by code (FR-3.9)' })
  async joinByCode(@Request() req: AuthenticatedRequest, @Body() dto: JoinByCodeDto) {
    const party = await this.inviteService.joinByCode(req.user.id, dto);
    const member = await this.memberService.getMember(party.id, req.user.id);
    await this.partyGateway.notifyMemberJoined(party.id, member);
    return party;
  }

  @Post('join/token')
  @ApiOperation({ summary: 'Join party by token (FR-3.10)' })
  async joinByToken(@Request() req: AuthenticatedRequest, @Body() dto: JoinByTokenDto) {
    const party = await this.inviteService.joinByToken(req.user.id, dto);
    const member = await this.memberService.getMember(party.id, req.user.id);
    await this.partyGateway.notifyMemberJoined(party.id, member);
    return party;
  }

  @Get(':partyId/messages')
  @ApiOperation({ summary: 'Get party messages (FR-4.1)' })
  @ApiParam({ name: 'partyId', type: String })
  async getMessages(
    @Request() req: AuthenticatedRequest,
    @Param('partyId') partyId: string,
    @Query() query: GetMessagesQueryDto,
  ) {
    return this.chatService.getMessages(partyId, req.user.id, query);
  }

  @Post(':partyId/messages')
  @ApiOperation({ summary: 'Send message (FR-4.2)' })
  @ApiParam({ name: 'partyId', type: String })
  async sendMessage(
    @Request() req: AuthenticatedRequest,
    @Param('partyId') partyId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(partyId, req.user.id, dto);
  }

  @Patch(':partyId/messages/:messageId')
  @ApiOperation({ summary: 'Edit message (FR-4.3)' })
  @ApiParam({ name: 'partyId', type: String })
  @ApiParam({ name: 'messageId', type: String })
  async editMessage(
    @Request() req: AuthenticatedRequest,
    @Param('messageId') messageId: string,
    @Body() dto: EditMessageDto,
  ) {
    return this.chatService.editMessage(messageId, req.user.id, dto);
  }

  @Delete(':partyId/messages/:messageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete message (FR-4.4)' })
  @ApiParam({ name: 'partyId', type: String })
  @ApiParam({ name: 'messageId', type: String })
  async deleteMessage(@Request() req: AuthenticatedRequest, @Param('messageId') messageId: string) {
    await this.chatService.deleteMessage(messageId, req.user.id);
  }

  @Post(':partyId/messages/:messageId/reactions')
  @ApiOperation({ summary: 'Add reaction (FR-4.5)' })
  @ApiParam({ name: 'partyId', type: String })
  @ApiParam({ name: 'messageId', type: String })
  async addReaction(
    @Request() req: AuthenticatedRequest,
    @Param('messageId') messageId: string,
    @Body() dto: AddReactionDto,
  ) {
    return this.chatService.addReaction(messageId, req.user.id, dto);
  }

  @Delete(':partyId/messages/:messageId/reactions/:reaction')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove reaction (FR-4.6)' })
  @ApiParam({ name: 'partyId', type: String })
  @ApiParam({ name: 'messageId', type: String })
  @ApiParam({ name: 'reaction', type: String })
  async removeReaction(
    @Request() req: AuthenticatedRequest,
    @Param('messageId') messageId: string,
    @Param('reaction') reaction: string,
  ) {
    await this.chatService.removeReaction(messageId, req.user.id, reaction);
  }

  @Post(':partyId/messages/:messageId/pin')
  @ApiOperation({ summary: 'Pin message (FR-4.7)' })
  @ApiParam({ name: 'partyId', type: String })
  @ApiParam({ name: 'messageId', type: String })
  async pinMessage(
    @Request() req: AuthenticatedRequest,
    @Param('partyId') partyId: string,
    @Param('messageId') messageId: string,
  ) {
    return this.chatService.pinMessage(partyId, messageId, req.user.id);
  }

  @Delete(':partyId/messages/:messageId/pin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unpin message (FR-4.8)' })
  @ApiParam({ name: 'partyId', type: String })
  @ApiParam({ name: 'messageId', type: String })
  async unpinMessage(
    @Request() req: AuthenticatedRequest,
    @Param('partyId') partyId: string,
    @Param('messageId') messageId: string,
  ) {
    await this.chatService.unpinMessage(partyId, messageId, req.user.id);
  }

  @Get(':partyId/messages/pinned')
  @ApiOperation({ summary: 'Get pinned messages (FR-4.9)' })
  @ApiParam({ name: 'partyId', type: String })
  async getPinnedMessages(@Param('partyId') partyId: string) {
    return this.chatService.getPinnedMessages(partyId);
  }

  @Post(':partyId/messages/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark messages as read (FR-4.10)' })
  @ApiParam({ name: 'partyId', type: String })
  async markAsRead(
    @Request() req: AuthenticatedRequest,
    @Param('partyId') partyId: string,
    @Body() dto: MarkAsReadDto,
  ) {
    await this.chatService.markAsRead(partyId, req.user.id, dto);
  }

  @Get(':partyId/settings')
  @ApiOperation({ summary: 'Get party settings (FR-5.1)' })
  @ApiParam({ name: 'partyId', type: String })
  async getSettings(@Param('partyId') partyId: string) {
    return this.settingsService.getSettings(partyId);
  }

  @Patch(':partyId/settings')
  @ApiOperation({ summary: 'Update party settings (FR-5.2)' })
  @ApiParam({ name: 'partyId', type: String })
  async updateSettings(
    @Request() req: AuthenticatedRequest,
    @Param('partyId') partyId: string,
    @Body() dto: UpdatePartySettingsDto,
  ) {
    const settings = await this.settingsService.updateSettings(partyId, req.user.id, dto);
    await this.partyGateway.notifySettingsUpdated(partyId, settings);
    return settings;
  }

  @Post(':partyId/settings/reset')
  @ApiOperation({ summary: 'Reset party settings (FR-5.3)' })
  @ApiParam({ name: 'partyId', type: String })
  async resetSettings(@Request() req: AuthenticatedRequest, @Param('partyId') partyId: string) {
    return this.settingsService.resetSettings(partyId, req.user.id);
  }

  @Post(':partyId/settings/wager')
  @ApiOperation({ summary: 'Enable wager (FR-5.4)' })
  @ApiParam({ name: 'partyId', type: String })
  async enableWager(
    @Request() req: AuthenticatedRequest,
    @Param('partyId') partyId: string,
    @Body() body: { amount: number; currency: string },
  ) {
    return this.settingsService.enableWager(partyId, req.user.id, body.amount, body.currency);
  }

  @Delete(':partyId/settings/wager')
  @ApiOperation({ summary: 'Disable wager (FR-5.5)' })
  @ApiParam({ name: 'partyId', type: String })
  async disableWager(@Request() req: AuthenticatedRequest, @Param('partyId') partyId: string) {
    return this.settingsService.disableWager(partyId, req.user.id);
  }

  @Post(':partyId/matchmaking/start')
  @ApiOperation({ summary: 'Start matchmaking (FR-6.1)' })
  @ApiParam({ name: 'partyId', type: String })
  async startMatchmaking(
    @Request() req: AuthenticatedRequest,
    @Param('partyId') partyId: string,
    @Body() dto: StartMatchmakingDto,
  ) {
    const ticket = await this.matchmakingService.startMatchmaking(partyId, req.user.id, dto);
    await this.partyGateway.notifyMatchmakingStarted(partyId, ticket);
    return ticket;
  }

  @Post(':partyId/matchmaking/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel matchmaking (FR-6.2)' })
  @ApiParam({ name: 'partyId', type: String })
  async cancelMatchmaking(
    @Request() req: AuthenticatedRequest,
    @Param('partyId') partyId: string,
    @Body() dto?: CancelMatchmakingDto,
  ) {
    await this.matchmakingService.cancelMatchmaking(partyId, req.user.id, dto);
    await this.partyGateway.notifyMatchmakingCancelled(partyId, dto?.reason);
  }

  @Get(':partyId/matchmaking/status')
  @ApiOperation({ summary: 'Get matchmaking status (FR-6.3)' })
  @ApiParam({ name: 'partyId', type: String })
  async getMatchmakingStatus(@Param('partyId') partyId: string) {
    return this.matchmakingService.getMatchmakingStatus(partyId);
  }

  @Post(':partyId/ready-check/start')
  @ApiOperation({ summary: 'Start ready check (FR-6.4)' })
  @ApiParam({ name: 'partyId', type: String })
  async startReadyCheck(
    @Request() req: AuthenticatedRequest,
    @Param('partyId') partyId: string,
    @Body() dto?: ReadyCheckDto,
  ) {
    const readyCheck = await this.matchmakingService.startReadyCheck(partyId, req.user.id, dto);
    await this.partyGateway.notifyReadyCheckStarted(partyId, readyCheck);
    return readyCheck;
  }

  @Post(':partyId/ready-check/respond')
  @ApiOperation({ summary: 'Respond to ready check (FR-6.5)' })
  @ApiParam({ name: 'partyId', type: String })
  async respondToReadyCheck(
    @Request() req: AuthenticatedRequest,
    @Param('partyId') partyId: string,
    @Body() dto: ReadyCheckResponseDto,
  ) {
    return this.matchmakingService.respondToReadyCheck(partyId, req.user.id, dto);
  }

  @Get(':partyId/ready-check/status')
  @ApiOperation({ summary: 'Get ready check status (FR-6.6)' })
  @ApiParam({ name: 'partyId', type: String })
  async getReadyCheckStatus(@Param('partyId') partyId: string) {
    return this.matchmakingService.getReadyCheckStatus(partyId);
  }

  @Post(':partyId/ready-check/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel ready check (FR-6.7)' })
  @ApiParam({ name: 'partyId', type: String })
  async cancelReadyCheck(@Request() req: AuthenticatedRequest, @Param('partyId') partyId: string) {
    await this.matchmakingService.cancelReadyCheck(partyId, req.user.id);
  }
}
