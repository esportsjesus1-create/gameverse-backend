import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTournamentTables1703836800000 implements MigrationInterface {
  name = 'CreateTournamentTables1703836800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "tournament_format_enum" AS ENUM (
        'single_elimination',
        'double_elimination',
        'swiss',
        'round_robin'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "tournament_status_enum" AS ENUM (
        'draft',
        'registration_open',
        'registration_closed',
        'check_in',
        'in_progress',
        'completed',
        'cancelled'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "tournament_visibility_enum" AS ENUM (
        'public',
        'private',
        'unlisted'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "registration_type_enum" AS ENUM (
        'open',
        'invite_only'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "tournaments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(255) NOT NULL,
        "description" text,
        "gameId" character varying(100) NOT NULL,
        "gameName" character varying(100),
        "format" "tournament_format_enum" NOT NULL DEFAULT 'single_elimination',
        "status" "tournament_status_enum" NOT NULL DEFAULT 'draft',
        "visibility" "tournament_visibility_enum" NOT NULL DEFAULT 'public',
        "registrationType" "registration_type_enum" NOT NULL DEFAULT 'open',
        "organizerId" uuid NOT NULL,
        "organizerName" character varying(100),
        "teamSize" integer NOT NULL DEFAULT 1,
        "maxParticipants" integer NOT NULL DEFAULT 16,
        "minParticipants" integer NOT NULL DEFAULT 2,
        "minMmr" integer,
        "maxMmr" integer,
        "requiresIdentityVerification" boolean NOT NULL DEFAULT false,
        "allowedRegions" text,
        "prizePool" numeric(18,8) NOT NULL DEFAULT 0,
        "prizeCurrency" character varying(10) NOT NULL DEFAULT 'USD',
        "prizeDistribution" jsonb,
        "entryFee" numeric(18,8) NOT NULL DEFAULT 0,
        "entryFeeCurrency" character varying(10) NOT NULL DEFAULT 'USD',
        "registrationStartDate" TIMESTAMP WITH TIME ZONE,
        "registrationEndDate" TIMESTAMP WITH TIME ZONE,
        "checkInStartDate" TIMESTAMP WITH TIME ZONE,
        "checkInEndDate" TIMESTAMP WITH TIME ZONE,
        "startDate" TIMESTAMP WITH TIME ZONE NOT NULL,
        "endDate" TIMESTAMP WITH TIME ZONE,
        "matchIntervalMinutes" integer NOT NULL DEFAULT 30,
        "rules" text,
        "allowSpectators" boolean NOT NULL DEFAULT true,
        "enableStreaming" boolean NOT NULL DEFAULT false,
        "streamUrl" character varying(500),
        "discordUrl" character varying(500),
        "bannerImageUrl" character varying(500),
        "thumbnailUrl" character varying(500),
        "swissRounds" integer NOT NULL DEFAULT 3,
        "grandFinalsReset" boolean NOT NULL DEFAULT true,
        "templateId" uuid,
        "metadata" jsonb,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tournaments" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_tournaments_status_startDate" ON "tournaments" ("status", "startDate")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_tournaments_gameId_status" ON "tournaments" ("gameId", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_tournaments_organizerId" ON "tournaments" ("organizerId")
    `);

    await queryRunner.query(`
      CREATE TYPE "registration_status_enum" AS ENUM (
        'pending',
        'confirmed',
        'checked_in',
        'waitlisted',
        'cancelled',
        'disqualified',
        'no_show'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "tournament_registrations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tournamentId" uuid NOT NULL,
        "participantId" uuid NOT NULL,
        "participantName" character varying(100) NOT NULL,
        "teamId" uuid,
        "teamName" character varying(100),
        "teamMemberIds" text,
        "teamMemberNames" text,
        "status" "registration_status_enum" NOT NULL DEFAULT 'pending',
        "seed" integer,
        "mmr" integer,
        "identityVerified" boolean NOT NULL DEFAULT false,
        "region" character varying(50),
        "entryFeePaid" numeric(18,8) NOT NULL DEFAULT 0,
        "paymentTransactionId" character varying(100),
        "checkedInAt" TIMESTAMP WITH TIME ZONE,
        "cancelledAt" TIMESTAMP WITH TIME ZONE,
        "cancellationReason" character varying(500),
        "refundIssued" boolean NOT NULL DEFAULT false,
        "refundAmount" numeric(18,8) NOT NULL DEFAULT 0,
        "refundTransactionId" character varying(100),
        "waitlistPosition" integer,
        "substitutedById" uuid,
        "substitutedByName" character varying(100),
        "substitutedAt" TIMESTAMP WITH TIME ZONE,
        "metadata" jsonb,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tournament_registrations" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tournament_registrations_tournament_participant" UNIQUE ("tournamentId", "participantId"),
        CONSTRAINT "FK_tournament_registrations_tournament" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_tournament_registrations_tournamentId_status" ON "tournament_registrations" ("tournamentId", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_tournament_registrations_participantId" ON "tournament_registrations" ("participantId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_tournament_registrations_teamId" ON "tournament_registrations" ("teamId")
    `);

    await queryRunner.query(`
      CREATE TYPE "bracket_type_enum" AS ENUM (
        'winners',
        'losers',
        'grand_finals',
        'swiss',
        'round_robin',
        'groups'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "bracket_status_enum" AS ENUM (
        'pending',
        'generated',
        'in_progress',
        'completed'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "tournament_brackets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tournamentId" uuid NOT NULL,
        "bracketType" "bracket_type_enum" NOT NULL DEFAULT 'winners',
        "format" "tournament_format_enum" NOT NULL DEFAULT 'single_elimination',
        "status" "bracket_status_enum" NOT NULL DEFAULT 'pending',
        "totalRounds" integer NOT NULL DEFAULT 0,
        "currentRound" integer NOT NULL DEFAULT 0,
        "totalMatches" integer NOT NULL DEFAULT 0,
        "completedMatches" integer NOT NULL DEFAULT 0,
        "participantCount" integer NOT NULL DEFAULT 0,
        "byeCount" integer NOT NULL DEFAULT 0,
        "seeds" jsonb,
        "bracketData" jsonb,
        "visualizationData" jsonb,
        "groupName" character varying(100),
        "groupNumber" integer,
        "advancingCount" integer,
        "metadata" jsonb,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tournament_brackets" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tournament_brackets_tournament" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_tournament_brackets_tournamentId_bracketType" ON "tournament_brackets" ("tournamentId", "bracketType")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_tournament_brackets_tournamentId_status" ON "tournament_brackets" ("tournamentId", "status")
    `);

    await queryRunner.query(`
      CREATE TYPE "match_status_enum" AS ENUM (
        'pending',
        'scheduled',
        'check_in',
        'in_progress',
        'awaiting_confirmation',
        'disputed',
        'completed',
        'cancelled',
        'postponed',
        'forfeit'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "match_type_enum" AS ENUM (
        'winners',
        'losers',
        'grand_finals',
        'grand_finals_reset',
        'swiss',
        'round_robin'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "tournament_matches" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tournamentId" uuid NOT NULL,
        "bracketId" uuid,
        "round" integer NOT NULL,
        "matchNumber" integer NOT NULL,
        "matchType" "match_type_enum" NOT NULL DEFAULT 'winners',
        "status" "match_status_enum" NOT NULL DEFAULT 'pending',
        "participant1Id" uuid,
        "participant1Name" character varying(100),
        "participant1Seed" integer,
        "participant2Id" uuid,
        "participant2Name" character varying(100),
        "participant2Seed" integer,
        "participant1Score" integer,
        "participant2Score" integer,
        "winnerId" uuid,
        "winnerName" character varying(100),
        "loserId" uuid,
        "loserName" character varying(100),
        "participant1Confirmed" boolean NOT NULL DEFAULT false,
        "participant2Confirmed" boolean NOT NULL DEFAULT false,
        "adminOverride" boolean NOT NULL DEFAULT false,
        "adminOverrideBy" uuid,
        "adminOverrideAt" TIMESTAMP WITH TIME ZONE,
        "adminOverrideReason" character varying(500),
        "scheduledAt" TIMESTAMP WITH TIME ZONE,
        "startedAt" TIMESTAMP WITH TIME ZONE,
        "completedAt" TIMESTAMP WITH TIME ZONE,
        "participant1CheckedIn" boolean NOT NULL DEFAULT false,
        "participant2CheckedIn" boolean NOT NULL DEFAULT false,
        "participant1CheckedInAt" TIMESTAMP WITH TIME ZONE,
        "participant2CheckedInAt" TIMESTAMP WITH TIME ZONE,
        "serverId" character varying(100),
        "serverName" character varying(100),
        "lobbyCode" character varying(100),
        "streamUrl" character varying(500),
        "nextMatchId" uuid,
        "loserNextMatchId" uuid,
        "disputeReason" text,
        "disputeRaisedBy" uuid,
        "disputeRaisedAt" TIMESTAMP WITH TIME ZONE,
        "disputeResolution" text,
        "disputeResolvedBy" uuid,
        "disputeResolvedAt" TIMESTAMP WITH TIME ZONE,
        "gameStats" jsonb,
        "bestOf" integer NOT NULL DEFAULT 1,
        "gamesPlayed" integer NOT NULL DEFAULT 0,
        "metadata" jsonb,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tournament_matches" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tournament_matches_tournament" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_tournament_matches_bracket" FOREIGN KEY ("bracketId") REFERENCES "tournament_brackets"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_tournament_matches_tournamentId_status" ON "tournament_matches" ("tournamentId", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_tournament_matches_tournamentId_round" ON "tournament_matches" ("tournamentId", "round")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_tournament_matches_bracketId" ON "tournament_matches" ("bracketId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_tournament_matches_scheduledAt" ON "tournament_matches" ("scheduledAt")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_tournament_matches_participant1Id" ON "tournament_matches" ("participant1Id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_tournament_matches_participant2Id" ON "tournament_matches" ("participant2Id")
    `);

    await queryRunner.query(`
      CREATE TABLE "tournament_standings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tournamentId" uuid NOT NULL,
        "participantId" uuid NOT NULL,
        "participantName" character varying(100) NOT NULL,
        "teamId" uuid,
        "teamName" character varying(100),
        "rank" integer NOT NULL DEFAULT 0,
        "seed" integer NOT NULL DEFAULT 0,
        "points" numeric(10,2) NOT NULL DEFAULT 0,
        "wins" integer NOT NULL DEFAULT 0,
        "losses" integer NOT NULL DEFAULT 0,
        "draws" integer NOT NULL DEFAULT 0,
        "matchesPlayed" integer NOT NULL DEFAULT 0,
        "gamesWon" integer NOT NULL DEFAULT 0,
        "gamesLost" integer NOT NULL DEFAULT 0,
        "roundsWon" integer NOT NULL DEFAULT 0,
        "roundsLost" integer NOT NULL DEFAULT 0,
        "winRate" numeric(10,4) NOT NULL DEFAULT 0,
        "buchholzScore" integer NOT NULL DEFAULT 0,
        "opponentWinRate" integer NOT NULL DEFAULT 0,
        "headToHeadWins" integer NOT NULL DEFAULT 0,
        "currentStreak" integer NOT NULL DEFAULT 0,
        "streakType" character varying(10) NOT NULL DEFAULT 'none',
        "longestWinStreak" integer NOT NULL DEFAULT 0,
        "isEliminated" boolean NOT NULL DEFAULT false,
        "eliminatedInRound" integer,
        "eliminatedBy" uuid,
        "isDisqualified" boolean NOT NULL DEFAULT false,
        "disqualificationReason" character varying(500),
        "finalPlacement" integer,
        "gameStats" jsonb,
        "metadata" jsonb,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tournament_standings" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tournament_standings_tournament_participant" UNIQUE ("tournamentId", "participantId"),
        CONSTRAINT "FK_tournament_standings_tournament" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_tournament_standings_tournamentId_rank" ON "tournament_standings" ("tournamentId", "rank")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_tournament_standings_tournamentId_points" ON "tournament_standings" ("tournamentId", "points")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_tournament_standings_participantId" ON "tournament_standings" ("participantId")
    `);

    await queryRunner.query(`
      CREATE TYPE "prize_status_enum" AS ENUM (
        'pending',
        'calculated',
        'processing',
        'distributed',
        'failed',
        'cancelled'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "prize_type_enum" AS ENUM (
        'cash',
        'token',
        'nft',
        'item',
        'points'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "tournament_prizes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tournamentId" uuid NOT NULL,
        "placement" integer NOT NULL,
        "recipientId" uuid,
        "recipientName" character varying(100),
        "teamId" uuid,
        "teamName" character varying(100),
        "prizeType" "prize_type_enum" NOT NULL DEFAULT 'cash',
        "amount" numeric(18,8) NOT NULL DEFAULT 0,
        "currency" character varying(10) NOT NULL DEFAULT 'USD',
        "percentageOfPool" numeric(5,2) NOT NULL DEFAULT 0,
        "status" "prize_status_enum" NOT NULL DEFAULT 'pending',
        "walletId" uuid,
        "walletAddress" character varying(200),
        "walletTransactionId" character varying(100),
        "distributedAt" TIMESTAMP WITH TIME ZONE,
        "distributedBy" uuid,
        "failureReason" text,
        "retryCount" integer NOT NULL DEFAULT 0,
        "lastRetryAt" TIMESTAMP WITH TIME ZONE,
        "identityVerified" boolean NOT NULL DEFAULT false,
        "taxFormSubmitted" boolean NOT NULL DEFAULT false,
        "taxFormId" character varying(100),
        "taxWithheld" numeric(18,8) NOT NULL DEFAULT 0,
        "netAmount" numeric(18,8) NOT NULL DEFAULT 0,
        "nftTokenId" character varying(100),
        "nftContractAddress" character varying(200),
        "nftChain" character varying(50),
        "itemDetails" jsonb,
        "metadata" jsonb,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tournament_prizes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tournament_prizes_tournament" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_tournament_prizes_tournamentId_placement" ON "tournament_prizes" ("tournamentId", "placement")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_tournament_prizes_tournamentId_status" ON "tournament_prizes" ("tournamentId", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_tournament_prizes_recipientId" ON "tournament_prizes" ("recipientId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_tournament_prizes_walletTransactionId" ON "tournament_prizes" ("walletTransactionId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tournament_prizes"`);
    await queryRunner.query(`DROP TYPE "prize_type_enum"`);
    await queryRunner.query(`DROP TYPE "prize_status_enum"`);
    await queryRunner.query(`DROP TABLE "tournament_standings"`);
    await queryRunner.query(`DROP TABLE "tournament_matches"`);
    await queryRunner.query(`DROP TYPE "match_type_enum"`);
    await queryRunner.query(`DROP TYPE "match_status_enum"`);
    await queryRunner.query(`DROP TABLE "tournament_brackets"`);
    await queryRunner.query(`DROP TYPE "bracket_status_enum"`);
    await queryRunner.query(`DROP TYPE "bracket_type_enum"`);
    await queryRunner.query(`DROP TABLE "tournament_registrations"`);
    await queryRunner.query(`DROP TYPE "registration_status_enum"`);
    await queryRunner.query(`DROP TABLE "tournaments"`);
    await queryRunner.query(`DROP TYPE "registration_type_enum"`);
    await queryRunner.query(`DROP TYPE "tournament_visibility_enum"`);
    await queryRunner.query(`DROP TYPE "tournament_status_enum"`);
    await queryRunner.query(`DROP TYPE "tournament_format_enum"`);
  }
}
