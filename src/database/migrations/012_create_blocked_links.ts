import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('blocked_links', (table) => {
    table.increments('id').primary();
    table.integer('group_id').unsigned().notNullable()
      .references('id').inTable('groups').onDelete('CASCADE');
    table.string('domain', 255).notNullable();
    table.string('added_by', 50).nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();

    table.unique(['group_id', 'domain']);
    table.index('group_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('blocked_links');
}
