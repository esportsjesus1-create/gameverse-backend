import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserPresence1703836800004 implements MigrationInterface {
  name = 'CreateUserPresence1703836800004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "presence_status_enum" AS ENUM ('online', 'offline', 'away', 'busy', 'invisible', 'in_game')
    `);

    await queryRunner.query(`
      CREATE TABLE "user_presence" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "status" "presence_status_enum" NOT NULL DEFAULT 'offline',
        "customMessage" varchar(255),
        "currentActivity" varchar(255),
        "currentGameId" varchar(255),
        "currentGameName" varchar(255),
        "platform" varchar(50),
        "deviceType" varchar(50),
        "lastSeenAt" timestamp NOT NULL DEFAULT now(),
        "lastActivityAt" timestamp,
        "isGamerstakeSynced" boolean NOT NULL DEFAULT false,
        "gamerstakeLastSyncAt" timestamp,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_user_presence_userId" UNIQUE ("userId"),
        CONSTRAINT "PK_user_presence" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_presence_user" FOREIGN KEY ("userId") REFERENCES "social_profiles"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_user_presence_userId" ON "user_presence" ("userId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_user_presence_status" ON "user_presence" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_user_presence_lastSeenAt" ON "user_presence" ("lastSeenAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_user_presence_lastSeenAt"`);
    await queryRunner.query(`DROP INDEX "IDX_user_presence_status"`);
    await queryRunner.query(`DROP INDEX "IDX_user_presence_userId"`);
    await queryRunner.query(`DROP TABLE "user_presence"`);
    await queryRunner.query(`DROP TYPE "presence_status_enum"`);
  }
}
