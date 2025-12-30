import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotifications1703836800005 implements MigrationInterface {
  name = 'CreateNotifications1703836800005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "notification_type_enum" AS ENUM (
        'friend_request',
        'friend_request_accepted',
        'new_follower',
        'post_liked',
        'post_commented',
        'achievement_unlocked',
        'game_invite',
        'mention',
        'system'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "notification_priority_enum" AS ENUM ('low', 'normal', 'high', 'urgent')
    `);

    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "recipientId" uuid NOT NULL,
        "senderId" uuid,
        "type" "notification_type_enum" NOT NULL,
        "title" varchar(255) NOT NULL,
        "message" text NOT NULL,
        "metadata" jsonb,
        "actionUrl" varchar(500),
        "priority" "notification_priority_enum" NOT NULL DEFAULT 'normal',
        "isRead" boolean NOT NULL DEFAULT false,
        "readAt" timestamp,
        "isDeleted" boolean NOT NULL DEFAULT false,
        "expiresAt" timestamp,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications" PRIMARY KEY ("id"),
        CONSTRAINT "FK_notifications_recipient" FOREIGN KEY ("recipientId") REFERENCES "social_profiles"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_notifications_sender" FOREIGN KEY ("senderId") REFERENCES "social_profiles"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_notifications_recipientId" ON "notifications" ("recipientId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_notifications_recipient_read_createdAt" ON "notifications" ("recipientId", "isRead", "createdAt")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_notifications_recipient_type" ON "notifications" ("recipientId", "type")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_notifications_createdAt" ON "notifications" ("createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_notifications_createdAt"`);
    await queryRunner.query(`DROP INDEX "IDX_notifications_recipient_type"`);
    await queryRunner.query(
      `DROP INDEX "IDX_notifications_recipient_read_createdAt"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_notifications_recipientId"`);
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TYPE "notification_priority_enum"`);
    await queryRunner.query(`DROP TYPE "notification_type_enum"`);
  }
}
