import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('commands', (table) => {
    table.increments('id').primary();
    table.string('name', 50).notNullable().unique();
    table.text('description').nullable();
    table.string('category', 50).notNullable().defaultTo('general');
    table.enum('permission_level', ['OWNER', 'SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'MEMBER'])
      .defaultTo('MEMBER').notNullable();
    table.boolean('enabled').defaultTo(true).notNullable();
    table.text('usage').nullable().comment('Usage example');
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();

    table.index('name');
    table.index('category');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('commands');
}
