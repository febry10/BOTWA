import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('banned_users', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.integer('group_id').unsigned().notNullable()
      .references('id').inTable('groups').onDelete('CASCADE');
    table.string('banned_by', 50).nullable();
    table.text('reason').nullable();
    table.timestamp('ban_until').nullable().comment('Null = permanent ban');
    table.boolean('permanent').defaultTo(false).notNullable();
    table.boolean('active').defaultTo(true).notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();

    table.index(['user_id', 'group_id', 'active']);
    table.index('ban_until');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('banned_users');
}
