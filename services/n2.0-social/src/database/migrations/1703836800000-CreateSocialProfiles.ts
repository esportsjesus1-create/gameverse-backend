import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSocialProfiles1703836800000 implements MigrationInterface {
  name = 'CreateSocialProfiles1703836800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "profile_visibility_enum" AS ENUM ('public', 'friends', 'private')
    `);

    await queryRunner.query(`
      CREATE TABLE "social_profiles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "username" varchar(50) NOT NULL,
        "displayName" varchar(100) NOT NULL,
        "bio" text,
        "avatarUrl" varchar(500),
        "bannerUrl" varchar(500),
        "location" varchar(100),
        "website" varchar(500),
        "visibility" "profile_visibility_enum" NOT NULL DEFAULT 'public',
        "gamingPlatforms" jsonb NOT NULL DEFAULT '[]',
        "gameStatistics" jsonb NOT NULL DEFAULT '[]',
        "achievements" jsonb NOT NULL DEFAULT '[]',
        "friendCount" integer NOT NULL DEFAULT 0,
        "followerCount" integer NOT NULL DEFAULT 0,
        "followingCount" integer NOT NULL DEFAULT 0,
        "isVerified" boolean NOT NULL DEFAULT false,
        "allowFriendRequests" boolean NOT NULL DEFAULT true,
        "showOnlineStatus" boolean NOT NULL DEFAULT true,
        "showGameActivity" boolean NOT NULL DEFAULT true,
        "gamerstakeUserId" varchar(255),
        "gamerstakeLastSyncAt" timestamp,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_social_profiles_userId" UNIQUE ("userId"),
        CONSTRAINT "UQ_social_profiles_username" UNIQUE ("username"),
        CONSTRAINT "PK_social_profiles" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_social_profiles_userId" ON "social_profiles" ("userId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_social_profiles_username" ON "social_profiles" ("username")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_social_profiles_displayName" ON "social_profiles" ("displayName")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_social_profiles_visibility" ON "social_profiles" ("visibility")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_social_profiles_visibility"`);
    await queryRunner.query(`DROP INDEX "IDX_social_profiles_displayName"`);
    await queryRunner.query(`DROP INDEX "IDX_social_profiles_username"`);
    await queryRunner.query(`DROP INDEX "IDX_social_profiles_userId"`);
    await queryRunner.query(`DROP TABLE "social_profiles"`);
    await queryRunner.query(`DROP TYPE "profile_visibility_enum"`);
  }
}
