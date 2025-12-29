import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFriendships1703836800001 implements MigrationInterface {
  name = 'CreateFriendships1703836800001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "friendship_status_enum" AS ENUM ('pending', 'accepted', 'rejected', 'cancelled')
    `);

    await queryRunner.query(`
      CREATE TABLE "friendships" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "requesterId" uuid NOT NULL,
        "addresseeId" uuid NOT NULL,
        "status" "friendship_status_enum" NOT NULL DEFAULT 'pending',
        "message" text,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        "acceptedAt" timestamp,
        CONSTRAINT "PK_friendships" PRIMARY KEY ("id"),
        CONSTRAINT "FK_friendships_requester" FOREIGN KEY ("requesterId") REFERENCES "social_profiles"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_friendships_addressee" FOREIGN KEY ("addresseeId") REFERENCES "social_profiles"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_friendships_requester_addressee" ON "friendships" ("requesterId", "addresseeId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_friendships_requesterId" ON "friendships" ("requesterId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_friendships_addresseeId" ON "friendships" ("addresseeId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_friendships_addressee_status" ON "friendships" ("addresseeId", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_friendships_requester_status" ON "friendships" ("requesterId", "status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_friendships_requester_status"`);
    await queryRunner.query(`DROP INDEX "IDX_friendships_addressee_status"`);
    await queryRunner.query(`DROP INDEX "IDX_friendships_addresseeId"`);
    await queryRunner.query(`DROP INDEX "IDX_friendships_requesterId"`);
    await queryRunner.query(`DROP INDEX "IDX_friendships_requester_addressee"`);
    await queryRunner.query(`DROP TABLE "friendships"`);
    await queryRunner.query(`DROP TYPE "friendship_status_enum"`);
  }
}
