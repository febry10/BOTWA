import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('user_stats', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.integer('group_id').unsigned().notNullable()
      .references('id').inTable('groups').onDelete('CASCADE');
    table.integer('xp').defaultTo(0).notNullable();
    table.integer('level').defaultTo(1).notNullable();
    table.integer('coins').defaultTo(0).notNullable();
    table.integer('message_count').defaultTo(0).notNullable();
    table.integer('wins').defaultTo(0).notNullable();
    table.integer('losses').defaultTo(0).notNullable();
    table.timestamp('last_xp_at').nullable();
    table.timestamp('last_daily_at').nullable();
    table.timestamp('last_hunt_at').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();

    table.unique(['user_id', 'group_id']);
    table.index(['group_id', 'xp']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('user_stats');
}
