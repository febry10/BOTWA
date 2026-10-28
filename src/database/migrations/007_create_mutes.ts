import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('mutes', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.integer('group_id').unsigned().notNullable()
      .references('id').inTable('groups').onDelete('CASCADE');
    table.string('muted_by', 50).nullable().comment('WA ID of admin, null if auto');
    table.text('reason').nullable();
    table.timestamp('mute_until').notNullable();
    table.boolean('active').defaultTo(true).notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('unmuted_at').nullable();

    table.index(['user_id', 'group_id', 'active']);
    table.index('mute_until');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('mutes');
}
