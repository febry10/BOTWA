import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('blacklist_words', (table) => {
    table.increments('id').primary();
    table.integer('group_id').unsigned().nullable()
      .references('id').inTable('groups').onDelete('CASCADE')
      .comment('Null = global word');
    table.string('word', 255).notNullable();
    table.enum('severity', ['LIGHT', 'MEDIUM', 'HEAVY']).defaultTo('MEDIUM').notNullable();
    table.string('added_by', 50).nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();

    table.index('group_id');
    table.index('word');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('blacklist_words');
}
