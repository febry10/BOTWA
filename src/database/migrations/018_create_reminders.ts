import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('reminders', (table) => {
    table.increments('id').primary();
    table.integer('group_id').unsigned().notNullable()
      .references('id').inTable('groups').onDelete('CASCADE');
    table.string('created_by', 100).nullable();
    table.text('message').notNullable();
    table.timestamp('remind_at').notNullable();
    table.enum('repeat', ['NONE', 'DAILY', 'WEEKLY']).defaultTo('NONE').notNullable();
    table.boolean('tag_all').defaultTo(true).notNullable();
    table.boolean('active').defaultTo(true).notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();

    table.index(['active', 'remind_at']);
    table.index('group_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('reminders');
}
