import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBlockedUsers1703836800002 implements MigrationInterface {
  name = 'CreateBlockedUsers1703836800002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "blocked_users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "blockerId" uuid NOT NULL,
        "blockedId" uuid NOT NULL,
        "reason" text,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_blocked_users" PRIMARY KEY ("id"),
        CONSTRAINT "FK_blocked_users_blocker" FOREIGN KEY ("blockerId") REFERENCES "social_profiles"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_blocked_users_blocked" FOREIGN KEY ("blockedId") REFERENCES "social_profiles"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_blocked_users_blocker_blocked" ON "blocked_users" ("blockerId", "blockedId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_blocked_users_blockerId" ON "blocked_users" ("blockerId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_blocked_users_blockedId" ON "blocked_users" ("blockedId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_blocked_users_blockedId"`);
    await queryRunner.query(`DROP INDEX "IDX_blocked_users_blockerId"`);
    await queryRunner.query(`DROP INDEX "IDX_blocked_users_blocker_blocked"`);
    await queryRunner.query(`DROP TABLE "blocked_users"`);
  }
}
