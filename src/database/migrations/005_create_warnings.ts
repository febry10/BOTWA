import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('warnings', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.integer('group_id').unsigned().notNullable()
      .references('id').inTable('groups').onDelete('CASCADE');
    table.text('reason').nullable();
    table.enum('severity', ['LIGHT', 'MEDIUM', 'HEAVY']).defaultTo('MEDIUM').notNullable();
    table.string('issued_by', 50).nullable().comment('WA ID of admin who issued, null if auto');
    table.timestamp('expires_at').nullable().comment('Auto-reset timestamp');
    table.boolean('active').defaultTo(true).notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();

    table.index(['user_id', 'group_id', 'active']);
    table.index('expires_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('warnings');
}
