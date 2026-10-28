import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('users', (table) => {
    table.increments('id').primary();
    table.string('wa_id', 50).notNullable().unique().comment('WhatsApp JID (e.g., 628xxx@s.whatsapp.net)');
    table.string('name', 255).nullable();
    table.string('phone_hash', 128).nullable().comment('Hashed phone number for privacy');
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();

    table.index('wa_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('users');
}
