import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('group_settings', (table) => {
    table.increments('id').primary();
    table.integer('group_id').unsigned().notNullable().unique()
      .references('id').inTable('groups').onDelete('CASCADE');
    table.jsonb('settings_json').notNullable().defaultTo('{}')
      .comment('Per-group configuration merged with defaults at runtime');
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();

    table.index('group_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('group_settings');
}
