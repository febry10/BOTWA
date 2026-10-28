import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('message_logs', (table) => {
    table.increments('id').primary();
    table.integer('group_id').unsigned().notNullable()
      .references('id').inTable('groups').onDelete('CASCADE');
    table.integer('user_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.string('message_type', 50).defaultTo('text').notNullable()
      .comment('text, image, video, audio, sticker, document');
    table.string('content_hash', 64).nullable().comment('SHA-256 hash for deduplication/privacy');
    table.enum('action', ['NONE', 'DELETE', 'WARN', 'MUTE', 'KICK', 'BAN']).defaultTo('NONE').notNullable();
    table.text('reason').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();

    table.index(['group_id', 'user_id']);
    table.index('action');
    table.index('created_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('message_logs');
}
