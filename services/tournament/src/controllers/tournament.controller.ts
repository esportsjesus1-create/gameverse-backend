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
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { TournamentService, TournamentQueryOptions } from '../services/tournament.service';
import { RegistrationService } from '../services/registration.service';
import { BracketService } from '../services/bracket.service';
import { MatchService } from '../services/match.service';
import { LeaderboardService } from '../services/leaderboard.service';
import { PrizeService } from '../services/prize.service';
import { CreateTournamentDto } from '../dto/create-tournament.dto';
import { UpdateTournamentDto } from '../dto/update-tournament.dto';
import {
  CreateRegistrationDto,
  SubstituteParticipantDto,
  BulkSeedDto,
} from '../dto/registration.dto';
import {
  GenerateBracketDto,
  ReseedBracketDto,
  DisqualifyParticipantDto,
  BracketResetDto,
  SwissPairingDto,
  ExportBracketDto,
} from '../dto/bracket.dto';
import {
  ScheduleMatchDto,
  SubmitMatchResultDto,
  ConfirmMatchResultDto,
  AdminOverrideResultDto,
  MatchCheckInDto,
  RaiseDisputeDto,
  ResolveDisputeDto,
  PostponeMatchDto,
  AssignServerDto,
} from '../dto/match.dto';
import {
  GetTournamentStandingsDto,
  GetGlobalLeaderboardDto,
  GetPlayerStatsDto,
  GetHistoricalResultsDto,
} from '../dto/leaderboard.dto';
import {
  SetupPrizePoolDto,
  CalculatePrizesDto,
  DistributePrizeDto,
  BulkDistributePrizesDto,
  UpdatePrizeStatusDto,
  SetRecipientWalletDto,
  VerifyRecipientDto,
  RetryDistributionDto,
} from '../dto/prize.dto';
import {
  Tournament,
  TournamentFormat,
  TournamentStatus,
  TournamentVisibility,
} from '../entities/tournament.entity';
import { RegistrationStatus } from '../entities/tournament-registration.entity';
import { MatchStatus } from '../entities/tournament-match.entity';

@ApiTags('Tournaments')
@Controller('tournaments')
export class TournamentController {
  constructor(
    private readonly tournamentService: TournamentService,
    private readonly registrationService: RegistrationService,
    private readonly bracketService: BracketService,
    private readonly matchService: MatchService,
    private readonly leaderboardService: LeaderboardService,
    private readonly prizeService: PrizeService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'FR-001: Create a new tournament' })
  @ApiResponse({ status: 201, description: 'Tournament created successfully' })
  async createTournament(@Body() dto: CreateTournamentDto): Promise<Tournament> {
    return this.tournamentService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all tournaments with filters' })
  @ApiQuery({ name: 'gameId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: TournamentStatus })
  @ApiQuery({ name: 'visibility', required: false, enum: TournamentVisibility })
  @ApiQuery({ name: 'format', required: false, enum: TournamentFormat })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getTournaments(@Query() query: TournamentQueryOptions) {
    return this.tournamentService.findAll(query);
  }

  @Get('public')
  @ApiOperation({ summary: 'FR-008: Get public tournaments' })
  async getPublicTournaments(@Query() query: TournamentQueryOptions) {
    return this.tournamentService.getPublicTournaments(query);
  }

  @Get('upcoming')
  @ApiOperation({ summary: 'Get upcoming tournaments' })
  @ApiQuery({ name: 'gameId', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getUpcomingTournaments(@Query('gameId') gameId?: string, @Query('limit') limit?: number) {
    return this.tournamentService.getUpcomingTournaments(gameId, limit);
  }

  @Get('organizer/:organizerId')
  @ApiOperation({ summary: 'Get tournaments by organizer' })
  @ApiParam({ name: 'organizerId', type: String })
  async getOrganizerTournaments(
    @Param('organizerId', ParseUUIDPipe) organizerId: string,
    @Query() query: TournamentQueryOptions,
  ) {
    return this.tournamentService.getOrganizerTournaments(organizerId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tournament by ID' })
  @ApiParam({ name: 'id', type: String })
  async getTournament(@Param('id', ParseUUIDPipe) id: string): Promise<Tournament> {
    return this.tournamentService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update tournament' })
  @ApiParam({ name: 'id', type: String })
  async updateTournament(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTournamentDto,
  ): Promise<Tournament> {
    return this.tournamentService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete tournament' })
  @ApiParam({ name: 'id', type: String })
  async deleteTournament(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.tournamentService.delete(id);
  }

  @Patch(':id/format')
  @ApiOperation({ summary: 'FR-002: Set tournament format' })
  @ApiParam({ name: 'id', type: String })
  async setFormat(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('format') format: TournamentFormat,
  ): Promise<Tournament> {
    return this.tournamentService.setFormat(id, format);
  }

  @Patch(':id/registration-config')
  @ApiOperation({ summary: 'FR-003: Configure registration settings' })
  @ApiParam({ name: 'id', type: String })
  async configureRegistration(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    config: {
      registrationType?: 'open' | 'invite_only';
      teamSize?: number;
      maxParticipants?: number;
      minParticipants?: number;
    },
  ): Promise<Tournament> {
    return this.tournamentService.configureRegistration(id, config);
  }

  @Patch(':id/entry-requirements')
  @ApiOperation({ summary: 'FR-004: Set entry requirements' })
  @ApiParam({ name: 'id', type: String })
  async setEntryRequirements(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    requirements: {
      minMmr?: number;
      maxMmr?: number;
      requiresIdentityVerification?: boolean;
      allowedRegions?: string[];
    },
  ): Promise<Tournament> {
    return this.tournamentService.setEntryRequirements(id, requirements);
  }

  @Patch(':id/prize-pool')
  @ApiOperation({ summary: 'FR-005: Configure prize pool' })
  @ApiParam({ name: 'id', type: String })
  async configurePrizePool(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    config: {
      prizePool: number;
      prizeCurrency?: string;
      prizeDistribution?: { placement: number; percentage: number }[];
    },
  ): Promise<Tournament> {
    return this.tournamentService.configurePrizePool(id, config);
  }

  @Patch(':id/schedule')
  @ApiOperation({ summary: 'FR-006: Set tournament schedule' })
  @ApiParam({ name: 'id', type: String })
  async setSchedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    schedule: {
      checkInStartDate?: string;
      checkInEndDate?: string;
      startDate?: string;
      endDate?: string;
      matchIntervalMinutes?: number;
    },
  ): Promise<Tournament> {
    return this.tournamentService.setSchedule(id, schedule);
  }

  @Patch(':id/rules')
  @ApiOperation({ summary: 'FR-007: Add tournament rules' })
  @ApiParam({ name: 'id', type: String })
  async setRules(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('rules') rules: string,
  ): Promise<Tournament> {
    return this.tournamentService.setRules(id, rules);
  }

  @Patch(':id/visibility')
  @ApiOperation({ summary: 'FR-008: Set tournament visibility' })
  @ApiParam({ name: 'id', type: String })
  async setVisibility(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('visibility') visibility: TournamentVisibility,
  ): Promise<Tournament> {
    return this.tournamentService.setVisibility(id, visibility);
  }

  @Patch(':id/streaming')
  @ApiOperation({ summary: 'FR-009: Configure streaming settings' })
  @ApiParam({ name: 'id', type: String })
  async configureStreaming(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() config: { allowSpectators?: boolean; enableStreaming?: boolean; streamUrl?: string },
  ): Promise<Tournament> {
    return this.tournamentService.configureStreaming(id, config);
  }

  @Post(':id/clone')
  @ApiOperation({ summary: 'FR-010: Clone tournament as template' })
  @ApiParam({ name: 'id', type: String })
  async cloneTournament(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { newName: string; organizerId: string },
  ): Promise<Tournament> {
    return this.tournamentService.cloneAsTemplate(id, body.newName, body.organizerId);
  }

  @Post(':id/open-registration')
  @ApiOperation({ summary: 'Open tournament registration' })
  @ApiParam({ name: 'id', type: String })
  async openRegistration(@Param('id', ParseUUIDPipe) id: string): Promise<Tournament> {
    return this.tournamentService.openRegistration(id);
  }

  @Post(':id/close-registration')
  @ApiOperation({ summary: 'Close tournament registration' })
  @ApiParam({ name: 'id', type: String })
  async closeRegistration(@Param('id', ParseUUIDPipe) id: string): Promise<Tournament> {
    return this.tournamentService.closeRegistration(id);
  }

  @Post(':id/start-check-in')
  @ApiOperation({ summary: 'Start check-in period' })
  @ApiParam({ name: 'id', type: String })
  async startCheckIn(@Param('id', ParseUUIDPipe) id: string): Promise<Tournament> {
    return this.tournamentService.startCheckIn(id);
  }

  @Post(':id/start')
  @ApiOperation({ summary: 'Start tournament' })
  @ApiParam({ name: 'id', type: String })
  async startTournament(@Param('id', ParseUUIDPipe) id: string): Promise<Tournament> {
    return this.tournamentService.startTournament(id);
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Complete tournament' })
  @ApiParam({ name: 'id', type: String })
  async completeTournament(@Param('id', ParseUUIDPipe) id: string): Promise<Tournament> {
    return this.tournamentService.completeTournament(id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel tournament' })
  @ApiParam({ name: 'id', type: String })
  async cancelTournament(@Param('id', ParseUUIDPipe) id: string): Promise<Tournament> {
    return this.tournamentService.cancelTournament(id);
  }

  @Post('registrations')
  @ApiOperation({ summary: 'FR-011: Register individual for tournament' })
  async registerIndividual(@Body() dto: CreateRegistrationDto) {
    return this.registrationService.registerIndividual(dto);
  }

  @Post('registrations/team')
  @ApiOperation({ summary: 'FR-012: Register team for tournament' })
  async registerTeam(@Body() dto: CreateRegistrationDto) {
    return this.registrationService.registerTeam(dto);
  }

  @Get(':tournamentId/registrations')
  @ApiOperation({ summary: 'Get tournament registrations' })
  @ApiParam({ name: 'tournamentId', type: String })
  @ApiQuery({ name: 'status', required: false, enum: RegistrationStatus })
  async getRegistrations(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Query('status') status?: RegistrationStatus,
  ) {
    return this.registrationService.getRegistrationsByTournament(tournamentId, status);
  }

  @Get(':tournamentId/registrations/waitlist')
  @ApiOperation({ summary: 'FR-014: Get registration waitlist' })
  @ApiParam({ name: 'tournamentId', type: String })
  async getWaitlist(@Param('tournamentId', ParseUUIDPipe) tournamentId: string) {
    return this.registrationService.getWaitlist(tournamentId);
  }

  @Get('registrations/:id')
  @ApiOperation({ summary: 'Get registration by ID' })
  @ApiParam({ name: 'id', type: String })
  async getRegistration(@Param('id', ParseUUIDPipe) id: string) {
    return this.registrationService.getRegistration(id);
  }

  @Post('registrations/:id/cancel')
  @ApiOperation({ summary: 'FR-015: Cancel registration' })
  @ApiParam({ name: 'id', type: String })
  async cancelRegistration(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason?: string,
  ) {
    return this.registrationService.cancelRegistration(id, reason);
  }

  @Post('registrations/:id/refund')
  @ApiOperation({ summary: 'FR-015: Issue refund for registration' })
  @ApiParam({ name: 'id', type: String })
  async issueRefund(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { refundAmount: number; transactionId: string },
  ) {
    return this.registrationService.issueRefund(id, body.refundAmount, body.transactionId);
  }

  @Post('registrations/:id/check-in')
  @ApiOperation({ summary: 'FR-017: Check-in to tournament' })
  @ApiParam({ name: 'id', type: String })
  async checkIn(@Param('id', ParseUUIDPipe) id: string) {
    return this.registrationService.checkIn(id);
  }

  @Post('registrations/:id/no-show')
  @ApiOperation({ summary: 'FR-018: Mark registration as no-show' })
  @ApiParam({ name: 'id', type: String })
  async markNoShow(@Param('id', ParseUUIDPipe) id: string) {
    return this.registrationService.markNoShow(id);
  }

  @Post('registrations/substitute')
  @ApiOperation({ summary: 'FR-018: Substitute participant' })
  async substituteParticipant(@Body() dto: SubstituteParticipantDto) {
    return this.registrationService.substituteParticipant(dto);
  }

  @Post(':tournamentId/registrations/seed-by-mmr')
  @ApiOperation({ summary: 'FR-019: Seed players by MMR' })
  @ApiParam({ name: 'tournamentId', type: String })
  async seedByMmr(@Param('tournamentId', ParseUUIDPipe) tournamentId: string) {
    return this.registrationService.seedByMmr(tournamentId);
  }

  @Patch('registrations/:id/seed')
  @ApiOperation({ summary: 'FR-020: Manual seed adjustment' })
  @ApiParam({ name: 'id', type: String })
  async setManualSeed(@Param('id', ParseUUIDPipe) id: string, @Body('seed') seed: number) {
    return this.registrationService.setManualSeed({ registrationId: id, seed });
  }

  @Post('registrations/bulk-seed')
  @ApiOperation({ summary: 'FR-020: Bulk seed adjustment' })
  async setBulkSeeds(@Body() dto: BulkSeedDto) {
    return this.registrationService.setBulkSeeds(dto);
  }

  @Post('brackets/generate')
  @ApiOperation({ summary: 'FR-021-024: Generate bracket' })
  async generateBracket(@Body() dto: GenerateBracketDto) {
    return this.bracketService.generateBracket(dto);
  }

  @Get(':tournamentId/brackets')
  @ApiOperation({ summary: 'Get tournament brackets' })
  @ApiParam({ name: 'tournamentId', type: String })
  async getBrackets(@Param('tournamentId', ParseUUIDPipe) tournamentId: string) {
    return this.bracketService.getBracketsByTournament(tournamentId);
  }

  @Get('brackets/:id')
  @ApiOperation({ summary: 'Get bracket by ID' })
  @ApiParam({ name: 'id', type: String })
  async getBracket(@Param('id', ParseUUIDPipe) id: string) {
    return this.bracketService.getBracket(id);
  }

  @Get('brackets/:id/visualization')
  @ApiOperation({ summary: 'FR-029: Get bracket visualization' })
  @ApiParam({ name: 'id', type: String })
  async getBracketVisualization(@Param('id', ParseUUIDPipe) id: string) {
    return this.bracketService.getBracketVisualization(id);
  }

  @Post('brackets/:id/handle-byes')
  @ApiOperation({ summary: 'FR-025: Handle bracket byes' })
  @ApiParam({ name: 'id', type: String })
  async handleByes(@Param('id', ParseUUIDPipe) id: string) {
    return this.bracketService.handleByes(id);
  }

  @Post('brackets/reseed')
  @ApiOperation({ summary: 'FR-026: Reseed bracket' })
  async reseedBracket(@Body() dto: ReseedBracketDto) {
    return this.bracketService.reseedBracket(dto);
  }

  @Post('brackets/disqualify')
  @ApiOperation({ summary: 'FR-027: Disqualify participant' })
  async disqualifyParticipant(@Body() dto: DisqualifyParticipantDto) {
    return this.bracketService.disqualifyParticipant(dto);
  }

  @Post('brackets/reset')
  @ApiOperation({ summary: 'FR-028: Bracket reset for grand finals' })
  async handleBracketReset(@Body() dto: BracketResetDto) {
    return this.bracketService.handleBracketReset(dto);
  }

  @Post('brackets/export')
  @ApiOperation({ summary: 'FR-030: Export bracket' })
  async exportBracket(@Body() dto: ExportBracketDto) {
    return this.bracketService.exportBracket(dto.tournamentId, dto.bracketId, dto.format);
  }

  @Post('brackets/swiss-pairing')
  @ApiOperation({ summary: 'FR-023: Generate Swiss pairings' })
  async generateSwissPairing(@Body() dto: SwissPairingDto) {
    return this.bracketService.generateSwissRound(dto);
  }

  @Post(':tournamentId/matches/auto-schedule')
  @ApiOperation({ summary: 'FR-031: Auto-schedule matches' })
  @ApiParam({ name: 'tournamentId', type: String })
  async autoScheduleMatches(@Param('tournamentId', ParseUUIDPipe) tournamentId: string) {
    return this.matchService.autoScheduleMatches(tournamentId);
  }

  @Post('matches/schedule')
  @ApiOperation({ summary: 'FR-032: Schedule match' })
  async scheduleMatch(@Body() dto: ScheduleMatchDto) {
    return this.matchService.scheduleMatch(dto);
  }

  @Get(':tournamentId/matches')
  @ApiOperation({ summary: 'Get tournament matches' })
  @ApiParam({ name: 'tournamentId', type: String })
  @ApiQuery({ name: 'status', required: false, enum: MatchStatus })
  @ApiQuery({ name: 'round', required: false, type: Number })
  @ApiQuery({ name: 'bracketId', required: false })
  async getMatches(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Query('status') status?: MatchStatus,
    @Query('round') round?: number,
    @Query('bracketId') bracketId?: string,
  ) {
    return this.matchService.getMatchesByTournament(tournamentId, { status, round, bracketId });
  }

  @Get(':tournamentId/matches/upcoming')
  @ApiOperation({ summary: 'Get upcoming matches' })
  @ApiParam({ name: 'tournamentId', type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getUpcomingMatches(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Query('limit') limit?: number,
  ) {
    return this.matchService.getUpcomingMatches(tournamentId, limit);
  }

  @Get(':tournamentId/matches/disputed')
  @ApiOperation({ summary: 'FR-039: Get disputed matches' })
  @ApiParam({ name: 'tournamentId', type: String })
  async getDisputedMatches(@Param('tournamentId', ParseUUIDPipe) tournamentId: string) {
    return this.matchService.getDisputedMatches(tournamentId);
  }

  @Get('matches/:id')
  @ApiOperation({ summary: 'Get match by ID' })
  @ApiParam({ name: 'id', type: String })
  async getMatch(@Param('id', ParseUUIDPipe) id: string) {
    return this.matchService.getMatch(id);
  }

  @Post('matches/check-in')
  @ApiOperation({ summary: 'FR-038: Match check-in' })
  async matchCheckIn(@Body() dto: MatchCheckInDto) {
    return this.matchService.checkInToMatch(dto);
  }

  @Post('matches/submit-result')
  @ApiOperation({ summary: 'FR-041: Submit match result' })
  async submitResult(@Body() dto: SubmitMatchResultDto) {
    return this.matchService.submitResult(dto);
  }

  @Post('matches/confirm-result')
  @ApiOperation({ summary: 'FR-042: Confirm match result' })
  async confirmResult(@Body() dto: ConfirmMatchResultDto) {
    return this.matchService.confirmResult(dto);
  }

  @Post('matches/admin-override')
  @ApiOperation({ summary: 'FR-043: Admin override result' })
  async adminOverrideResult(@Body() dto: AdminOverrideResultDto) {
    return this.matchService.adminOverrideResult(dto);
  }

  @Post('matches/raise-dispute')
  @ApiOperation({ summary: 'FR-039: Raise match dispute' })
  async raiseDispute(@Body() dto: RaiseDisputeDto) {
    return this.matchService.raiseDispute(dto);
  }

  @Post('matches/resolve-dispute')
  @ApiOperation({ summary: 'FR-039: Resolve match dispute' })
  async resolveDispute(@Body() dto: ResolveDisputeDto) {
    return this.matchService.resolveDispute(dto);
  }

  @Post('matches/postpone')
  @ApiOperation({ summary: 'FR-040: Postpone match' })
  async postponeMatch(@Body() dto: PostponeMatchDto) {
    return this.matchService.postponeMatch(dto);
  }

  @Post('matches/assign-server')
  @ApiOperation({ summary: 'FR-036: Assign server to match' })
  async assignServer(@Body() dto: AssignServerDto) {
    return this.matchService.assignServer(dto);
  }

  @Patch('matches/:id/status')
  @ApiOperation({ summary: 'Update match status' })
  @ApiParam({ name: 'id', type: String })
  async updateMatchStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { status: MatchStatus; reason?: string },
  ) {
    return this.matchService.updateMatchStatus({ matchId: id, ...body });
  }

  @Get('matches/:id/detect-manipulation')
  @ApiOperation({ summary: 'FR-046: Detect result manipulation' })
  @ApiParam({ name: 'id', type: String })
  async detectManipulation(@Param('id', ParseUUIDPipe) id: string) {
    return { suspicious: await this.matchService.detectResultManipulation(id) };
  }

  @Get(':tournamentId/standings')
  @ApiOperation({ summary: 'FR-047: Get tournament standings' })
  @ApiParam({ name: 'tournamentId', type: String })
  async getTournamentStandings(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Query() query: Omit<GetTournamentStandingsDto, 'tournamentId'>,
  ) {
    return this.leaderboardService.getTournamentStandings({ tournamentId, ...query });
  }

  @Get(':tournamentId/standings/realtime')
  @ApiOperation({ summary: 'FR-047: Get real-time standings' })
  @ApiParam({ name: 'tournamentId', type: String })
  async getRealTimeStandings(@Param('tournamentId', ParseUUIDPipe) tournamentId: string) {
    return this.leaderboardService.getRealTimeStandings(tournamentId);
  }

  @Get('leaderboard/global')
  @ApiOperation({ summary: 'FR-050: Get global leaderboard' })
  async getGlobalLeaderboard(@Query() query: GetGlobalLeaderboardDto) {
    return this.leaderboardService.getGlobalLeaderboard(query);
  }

  @Get('leaderboard/player/:playerId')
  @ApiOperation({ summary: 'FR-049: Get player statistics' })
  @ApiParam({ name: 'playerId', type: String })
  async getPlayerStats(
    @Param('playerId', ParseUUIDPipe) playerId: string,
    @Query() query: Omit<GetPlayerStatsDto, 'playerId'>,
  ) {
    return this.leaderboardService.getPlayerStats({ playerId, ...query });
  }

  @Get('leaderboard/history')
  @ApiOperation({ summary: 'FR-048: Get historical results' })
  async getHistoricalResults(@Query() query: GetHistoricalResultsDto) {
    return this.leaderboardService.getHistoricalResults(query);
  }

  @Post(':tournamentId/standings/recalculate')
  @ApiOperation({ summary: 'FR-045: Recalculate standings' })
  @ApiParam({ name: 'tournamentId', type: String })
  async recalculateStandings(@Param('tournamentId', ParseUUIDPipe) tournamentId: string) {
    await this.leaderboardService.recalculateStandings(tournamentId);
    return { success: true };
  }

  @Post(':tournamentId/standings/buchholz')
  @ApiOperation({ summary: 'Calculate Buchholz scores for Swiss' })
  @ApiParam({ name: 'tournamentId', type: String })
  async calculateBuchholz(@Param('tournamentId', ParseUUIDPipe) tournamentId: string) {
    await this.leaderboardService.calculateBuchholzScores(tournamentId);
    return { success: true };
  }

  @Post('prizes/setup')
  @ApiOperation({ summary: 'FR-051: Setup prize pool' })
  async setupPrizePool(@Body() dto: SetupPrizePoolDto) {
    return this.prizeService.setupPrizePool(dto);
  }

  @Post('prizes/calculate')
  @ApiOperation({ summary: 'FR-051: Calculate prizes' })
  async calculatePrizes(@Body() dto: CalculatePrizesDto) {
    return this.prizeService.calculatePrizes(dto);
  }

  @Get(':tournamentId/prizes')
  @ApiOperation({ summary: 'Get tournament prizes' })
  @ApiParam({ name: 'tournamentId', type: String })
  async getPrizes(@Param('tournamentId', ParseUUIDPipe) tournamentId: string) {
    return this.prizeService.getPrizesByTournament(tournamentId);
  }

  @Get(':tournamentId/prizes/summary')
  @ApiOperation({ summary: 'Get prize summary' })
  @ApiParam({ name: 'tournamentId', type: String })
  async getPrizeSummary(@Param('tournamentId', ParseUUIDPipe) tournamentId: string) {
    return this.prizeService.getPrizeSummary(tournamentId);
  }

  @Get('prizes/:id')
  @ApiOperation({ summary: 'Get prize by ID' })
  @ApiParam({ name: 'id', type: String })
  async getPrize(@Param('id', ParseUUIDPipe) id: string) {
    return this.prizeService.getPrize(id);
  }

  @Post('prizes/distribute')
  @ApiOperation({ summary: 'FR-052: Distribute prize' })
  async distributePrize(@Body() dto: DistributePrizeDto) {
    return this.prizeService.distributePrize(dto);
  }

  @Post('prizes/bulk-distribute')
  @ApiOperation({ summary: 'FR-052: Bulk distribute prizes' })
  async bulkDistributePrizes(@Body() dto: BulkDistributePrizesDto) {
    return this.prizeService.bulkDistributePrizes(dto);
  }

  @Post('prizes/retry')
  @ApiOperation({ summary: 'Retry failed prize distribution' })
  async retryDistribution(@Body() dto: RetryDistributionDto) {
    return this.prizeService.retryDistribution(dto);
  }

  @Patch('prizes/:id/status')
  @ApiOperation({ summary: 'Update prize status' })
  @ApiParam({ name: 'id', type: String })
  async updatePrizeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Omit<UpdatePrizeStatusDto, 'prizeId'>,
  ) {
    return this.prizeService.updatePrizeStatus({ prizeId: id, ...body });
  }

  @Post('prizes/:id/wallet')
  @ApiOperation({ summary: 'Set recipient wallet' })
  @ApiParam({ name: 'id', type: String })
  async setRecipientWallet(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Omit<SetRecipientWalletDto, 'prizeId'>,
  ) {
    return this.prizeService.setRecipientWallet({ prizeId: id, ...body });
  }

  @Post('prizes/:id/verify')
  @ApiOperation({ summary: 'Verify prize recipient' })
  @ApiParam({ name: 'id', type: String })
  async verifyRecipient(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Omit<VerifyRecipientDto, 'prizeId'>,
  ) {
    return this.prizeService.verifyRecipient({ prizeId: id, ...body });
  }

  @Post('prizes/:id/tax')
  @ApiOperation({ summary: 'Calculate tax withholding' })
  @ApiParam({ name: 'id', type: String })
  async calculateTax(@Param('id', ParseUUIDPipe) id: string, @Body('taxRate') taxRate: number) {
    return this.prizeService.calculateTaxWithholding(id, taxRate);
  }

  @Get('prizes/recipient/:recipientId')
  @ApiOperation({ summary: 'Get prizes by recipient' })
  @ApiParam({ name: 'recipientId', type: String })
  async getPrizesByRecipient(@Param('recipientId', ParseUUIDPipe) recipientId: string) {
    return this.prizeService.getPrizesByRecipient(recipientId);
  }

  @Get('prizes/recipient/:recipientId/earnings')
  @ApiOperation({ summary: 'Get total prize earnings' })
  @ApiParam({ name: 'recipientId', type: String })
  async getTotalEarnings(@Param('recipientId', ParseUUIDPipe) recipientId: string) {
    return this.prizeService.getTotalPrizeEarnings(recipientId);
  }

  @Delete('prizes/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel prize' })
  @ApiParam({ name: 'id', type: String })
  async cancelPrize(@Param('id', ParseUUIDPipe) id: string, @Body('reason') reason: string) {
    return this.prizeService.cancelPrize(id, reason);
  }
}
