import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSocialFeedEvents1703836800003 implements MigrationInterface {
  name = 'CreateSocialFeedEvents1703836800003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "feed_event_type_enum" AS ENUM ('status_update', 'achievement', 'game_result', 'profile_update', 'milestone')
    `);

    await queryRunner.query(`
      CREATE TYPE "feed_event_visibility_enum" AS ENUM ('public', 'friends', 'private')
    `);

    await queryRunner.query(`
      CREATE TABLE "social_feed_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "authorId" uuid NOT NULL,
        "eventType" "feed_event_type_enum" NOT NULL DEFAULT 'status_update',
        "content" text NOT NULL,
        "metadata" jsonb,
        "visibility" "feed_event_visibility_enum" NOT NULL DEFAULT 'friends',
        "likeCount" integer NOT NULL DEFAULT 0,
        "commentCount" integer NOT NULL DEFAULT 0,
        "shareCount" integer NOT NULL DEFAULT 0,
        "isDeleted" boolean NOT NULL DEFAULT false,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_social_feed_events" PRIMARY KEY ("id"),
        CONSTRAINT "FK_social_feed_events_author" FOREIGN KEY ("authorId") REFERENCES "social_profiles"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_social_feed_events_authorId" ON "social_feed_events" ("authorId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_social_feed_events_author_createdAt" ON "social_feed_events" ("authorId", "createdAt")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_social_feed_events_eventType" ON "social_feed_events" ("eventType")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_social_feed_events_visibility" ON "social_feed_events" ("visibility")
    `);

    await queryRunner.query(`
      CREATE TABLE "feed_event_likes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "eventId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_feed_event_likes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_feed_event_likes_event" FOREIGN KEY ("eventId") REFERENCES "social_feed_events"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_feed_event_likes_user" FOREIGN KEY ("userId") REFERENCES "social_profiles"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_feed_event_likes_event_user" ON "feed_event_likes" ("eventId", "userId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_feed_event_likes_eventId" ON "feed_event_likes" ("eventId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_feed_event_likes_userId" ON "feed_event_likes" ("userId")
    `);

    await queryRunner.query(`
      CREATE TABLE "feed_event_comments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "eventId" uuid NOT NULL,
        "authorId" uuid NOT NULL,
        "content" text NOT NULL,
        "parentCommentId" uuid,
        "isDeleted" boolean NOT NULL DEFAULT false,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_feed_event_comments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_feed_event_comments_event" FOREIGN KEY ("eventId") REFERENCES "social_feed_events"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_feed_event_comments_author" FOREIGN KEY ("authorId") REFERENCES "social_profiles"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_feed_event_comments_eventId" ON "feed_event_comments" ("eventId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_feed_event_comments_authorId" ON "feed_event_comments" ("authorId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_feed_event_comments_event_createdAt" ON "feed_event_comments" ("eventId", "createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_feed_event_comments_event_createdAt"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_feed_event_comments_authorId"`);
    await queryRunner.query(`DROP INDEX "IDX_feed_event_comments_eventId"`);
    await queryRunner.query(`DROP TABLE "feed_event_comments"`);
    await queryRunner.query(`DROP INDEX "IDX_feed_event_likes_userId"`);
    await queryRunner.query(`DROP INDEX "IDX_feed_event_likes_eventId"`);
    await queryRunner.query(`DROP INDEX "IDX_feed_event_likes_event_user"`);
    await queryRunner.query(`DROP TABLE "feed_event_likes"`);
    await queryRunner.query(`DROP INDEX "IDX_social_feed_events_visibility"`);
    await queryRunner.query(`DROP INDEX "IDX_social_feed_events_eventType"`);
    await queryRunner.query(
      `DROP INDEX "IDX_social_feed_events_author_createdAt"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_social_feed_events_authorId"`);
    await queryRunner.query(`DROP TABLE "social_feed_events"`);
    await queryRunner.query(`DROP TYPE "feed_event_visibility_enum"`);
    await queryRunner.query(`DROP TYPE "feed_event_type_enum"`);
  }
}
