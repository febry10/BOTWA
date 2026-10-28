import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('violations', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.integer('group_id').unsigned().notNullable()
      .references('id').inTable('groups').onDelete('CASCADE');
    table.enum('type', ['PROFANITY', 'SPAM', 'FLOOD', 'LINK', 'MENTION', 'INVITE', 'BLACKLIST', 'OTHER'])
      .notNullable();
    table.enum('severity', ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).defaultTo('MEDIUM').notNullable();
    table.text('message_content').nullable().comment('Original message content (optional, privacy-configurable)');
    table.string('content_hash', 64).nullable().comment('SHA-256 hash of message content');
    table.enum('action_taken', ['NONE', 'DELETE', 'WARN', 'MUTE', 'KICK', 'BAN'])
      .defaultTo('NONE').notNullable();
    table.text('details').nullable().comment('Additional details about the violation');
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();

    table.index(['user_id', 'group_id']);
    table.index('type');
    table.index('created_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('violations');
}
