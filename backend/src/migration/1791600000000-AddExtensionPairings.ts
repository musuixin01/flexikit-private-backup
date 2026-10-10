import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExtensionPairings1791600000000 implements MigrationInterface {
  name = 'AddExtensionPairings1791600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "extension_pairings" (
        "code" varchar(10) NOT NULL PRIMARY KEY,
        "client_instance_id" uuid NOT NULL,
        "verifier_hash" varchar(64) NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "approved_user_id" integer NULL,
        "consumed_at" timestamptz NULL,
        "failed_claims" integer NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_extension_pairings_approved_user"
          FOREIGN KEY ("approved_user_id") REFERENCES "users"("id")
          ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_extension_pairings_expires_at" ON "extension_pairings" ("expires_at")');
    await queryRunner.query('CREATE INDEX "IDX_extension_pairings_client_instance" ON "extension_pairings" ("client_instance_id")');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "extension_pairings"');
  }
}
