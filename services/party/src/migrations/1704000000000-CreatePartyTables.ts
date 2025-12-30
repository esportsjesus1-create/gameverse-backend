import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePartyTables1704000000000 implements MigrationInterface {
  name = 'CreatePartyTables1704000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "party_status_enum" AS ENUM ('active', 'in_queue', 'in_game', 'disbanded')
    `);

    await queryRunner.query(`
      CREATE TYPE "party_visibility_enum" AS ENUM ('public', 'friends_only', 'invite_only', 'private')
    `);

    await queryRunner.query(`
      CREATE TYPE "member_role_enum" AS ENUM ('leader', 'co_leader', 'member')
    `);

    await queryRunner.query(`
      CREATE TYPE "member_status_enum" AS ENUM ('active', 'away', 'busy', 'in_game', 'offline')
    `);

    await queryRunner.query(`
      CREATE TYPE "ready_status_enum" AS ENUM ('not_ready', 'ready', 'pending')
    `);

    await queryRunner.query(`
      CREATE TYPE "invite_status_enum" AS ENUM ('pending', 'accepted', 'declined', 'expired', 'cancelled')
    `);

    await queryRunner.query(`
      CREATE TYPE "invite_type_enum" AS ENUM ('direct', 'link', 'code', 'friend_request')
    `);

    await queryRunner.query(`
      CREATE TYPE "message_type_enum" AS ENUM ('text', 'system', 'emote', 'image', 'voice_clip', 'game_event', 'ready_check', 'matchmaking_update')
    `);

    await queryRunner.query(`
      CREATE TYPE "message_status_enum" AS ENUM ('sent', 'delivered', 'read', 'deleted', 'moderated')
    `);

    await queryRunner.query(`
      CREATE TABLE "parties" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar(100) NOT NULL,
        "leader_id" uuid NOT NULL,
        "leader_username" varchar(50),
        "game_id" uuid,
        "game_name" varchar(100),
        "game_mode" varchar(50),
        "status" "party_status_enum" NOT NULL DEFAULT 'active',
        "visibility" "party_visibility_enum" NOT NULL DEFAULT 'friends_only',
        "max_size" int NOT NULL DEFAULT 4,
        "current_size" int NOT NULL DEFAULT 1,
        "min_rank" int NOT NULL DEFAULT 0,
        "max_rank" int NOT NULL DEFAULT 10000,
        "region" varchar(10),
        "language" varchar(10),
        "description" text,
        "join_code" varchar(6) UNIQUE,
        "is_matchmaking" boolean NOT NULL DEFAULT false,
        "matchmaking_ticket_id" uuid,
        "matchmaking_started_at" timestamp,
        "current_match_id" uuid,
        "metadata" jsonb,
        "requires_wallet" boolean NOT NULL DEFAULT false,
        "minimum_wallet_balance" decimal(18,8),
        "wallet_currency" varchar(10),
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "disbanded_at" timestamp,
        "settings_id" uuid,
        CONSTRAINT "PK_parties" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_parties_status_game" ON "parties" ("status", "game_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_parties_leader" ON "parties" ("leader_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_parties_created" ON "parties" ("created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_parties_join_code" ON "parties" ("join_code")
    `);

    await queryRunner.query(`
      CREATE TABLE "party_settings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "party_id" uuid NOT NULL UNIQUE,
        "allow_invites" boolean NOT NULL DEFAULT true,
        "members_can_invite" boolean NOT NULL DEFAULT false,
        "auto_accept_friends" boolean NOT NULL DEFAULT true,
        "require_approval" boolean NOT NULL DEFAULT false,
        "chat_enabled" boolean NOT NULL DEFAULT true,
        "voice_chat_enabled" boolean NOT NULL DEFAULT true,
        "push_to_talk" boolean NOT NULL DEFAULT false,
        "notifications_enabled" boolean NOT NULL DEFAULT true,
        "sounds_enabled" boolean NOT NULL DEFAULT true,
        "auto_ready_check" boolean NOT NULL DEFAULT false,
        "ready_check_timeout" int NOT NULL DEFAULT 30,
        "show_member_status" boolean NOT NULL DEFAULT true,
        "show_member_rank" boolean NOT NULL DEFAULT true,
        "anonymous_mode" boolean NOT NULL DEFAULT false,
        "strict_rank_matching" boolean NOT NULL DEFAULT false,
        "rank_tolerance" int NOT NULL DEFAULT 500,
        "allow_spectators" boolean NOT NULL DEFAULT true,
        "max_spectators" int NOT NULL DEFAULT 0,
        "stream_mode" boolean NOT NULL DEFAULT false,
        "stream_delay" int NOT NULL DEFAULT 0,
        "tournament_mode" boolean NOT NULL DEFAULT false,
        "tournament_id" uuid,
        "wager_enabled" boolean NOT NULL DEFAULT false,
        "wager_amount" decimal(18,8),
        "wager_currency" varchar(10),
        "require_wallet_verification" boolean NOT NULL DEFAULT false,
        "minimum_balance" decimal(18,8),
        "preferred_servers" jsonb,
        "blocked_regions" jsonb,
        "max_ping" int NOT NULL DEFAULT 100,
        "game_specific_settings" jsonb,
        "custom_roles" jsonb,
        "chat_filters" jsonb,
        "matchmaking_preferences" jsonb,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_party_settings" PRIMARY KEY ("id"),
        CONSTRAINT "FK_party_settings_party" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_party_settings_party" ON "party_settings" ("party_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "party_members" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "party_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "username" varchar(50) NOT NULL,
        "avatar_url" varchar(255),
        "role" "member_role_enum" NOT NULL DEFAULT 'member',
        "status" "member_status_enum" NOT NULL DEFAULT 'active',
        "ready_status" "ready_status_enum" NOT NULL DEFAULT 'not_ready',
        "rank" int,
        "level" int,
        "preferred_role" varchar(50),
        "is_muted" boolean NOT NULL DEFAULT false,
        "is_deafened" boolean NOT NULL DEFAULT false,
        "can_invite" boolean NOT NULL DEFAULT true,
        "can_kick" boolean NOT NULL DEFAULT false,
        "can_change_settings" boolean NOT NULL DEFAULT false,
        "can_start_matchmaking" boolean NOT NULL DEFAULT false,
        "game_stats" jsonb,
        "metadata" jsonb,
        "wallet_verified" boolean NOT NULL DEFAULT false,
        "wallet_balance" decimal(18,8),
        "last_active_at" timestamp,
        "joined_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "left_at" timestamp,
        CONSTRAINT "PK_party_members" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_party_members_party_user" UNIQUE ("party_id", "user_id"),
        CONSTRAINT "FK_party_members_party" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_party_members_user" ON "party_members" ("user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_party_members_party" ON "party_members" ("party_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_party_members_party_role" ON "party_members" ("party_id", "role")
    `);

    await queryRunner.query(`
      CREATE TABLE "party_invites" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "party_id" uuid NOT NULL,
        "inviter_id" uuid NOT NULL,
        "inviter_username" varchar(50) NOT NULL,
        "invitee_id" uuid,
        "invitee_username" varchar(50),
        "invitee_email" varchar(255),
        "type" "invite_type_enum" NOT NULL DEFAULT 'direct',
        "status" "invite_status_enum" NOT NULL DEFAULT 'pending',
        "message" text,
        "invite_token" varchar(100),
        "max_uses" int NOT NULL DEFAULT 0,
        "current_uses" int NOT NULL DEFAULT 0,
        "expires_at" timestamp NOT NULL,
        "responded_at" timestamp,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_party_invites" PRIMARY KEY ("id"),
        CONSTRAINT "FK_party_invites_party" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_party_invites_party_invitee" ON "party_invites" ("party_id", "invitee_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_party_invites_invitee_status" ON "party_invites" ("invitee_id", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_party_invites_expires" ON "party_invites" ("expires_at")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_party_invites_token" ON "party_invites" ("invite_token")
    `);

    await queryRunner.query(`
      CREATE TABLE "party_chat_messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "party_id" uuid NOT NULL,
        "sender_id" uuid,
        "sender_username" varchar(50),
        "sender_avatar_url" varchar(255),
        "type" "message_type_enum" NOT NULL DEFAULT 'text',
        "content" text NOT NULL,
        "status" "message_status_enum" NOT NULL DEFAULT 'sent',
        "reply_to_id" uuid,
        "attachments" jsonb,
        "reactions" jsonb,
        "mentions" jsonb,
        "is_pinned" boolean NOT NULL DEFAULT false,
        "pinned_by" uuid,
        "pinned_at" timestamp,
        "is_edited" boolean NOT NULL DEFAULT false,
        "edited_at" timestamp,
        "metadata" jsonb,
        "read_by" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "deleted_at" timestamp,
        CONSTRAINT "PK_party_chat_messages" PRIMARY KEY ("id"),
        CONSTRAINT "FK_party_chat_messages_party" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_party_chat_messages_party_created" ON "party_chat_messages" ("party_id", "created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_party_chat_messages_sender" ON "party_chat_messages" ("sender_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "parties" ADD CONSTRAINT "FK_parties_settings" FOREIGN KEY ("settings_id") REFERENCES "party_settings"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "parties" DROP CONSTRAINT "FK_parties_settings"`);
    await queryRunner.query(`DROP TABLE "party_chat_messages"`);
    await queryRunner.query(`DROP TABLE "party_invites"`);
    await queryRunner.query(`DROP TABLE "party_members"`);
    await queryRunner.query(`DROP TABLE "party_settings"`);
    await queryRunner.query(`DROP TABLE "parties"`);
    await queryRunner.query(`DROP TYPE "message_status_enum"`);
    await queryRunner.query(`DROP TYPE "message_type_enum"`);
    await queryRunner.query(`DROP TYPE "invite_type_enum"`);
    await queryRunner.query(`DROP TYPE "invite_status_enum"`);
    await queryRunner.query(`DROP TYPE "ready_status_enum"`);
    await queryRunner.query(`DROP TYPE "member_status_enum"`);
    await queryRunner.query(`DROP TYPE "member_role_enum"`);
    await queryRunner.query(`DROP TYPE "party_visibility_enum"`);
    await queryRunner.query(`DROP TYPE "party_status_enum"`);
  }
}
