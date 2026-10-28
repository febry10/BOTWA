import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('admin_logs', (table) => {
    table.increments('id').primary();
    table.integer('group_id').unsigned().notNullable()
      .references('id').inTable('groups').onDelete('CASCADE');
    table.integer('admin_user_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.integer('target_user_id').unsigned().nullable()
      .references('id').inTable('users').onDelete('SET NULL');
    table.string('command', 100).notNullable();
    table.jsonb('details').nullable().comment('Additional command parameters/results');
    table.text('result').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();

    table.index(['group_id', 'created_at']);
    table.index('admin_user_id');
    table.index('command');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('admin_logs');
}
