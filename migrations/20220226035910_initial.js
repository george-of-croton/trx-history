/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async (knex) => {
  await knex.schema.createTable('account', (table) => {
    table.string('id').primary().index();
    table.string('address').notNullable().unique();
    table.timestamp('created_at');
  });
  await knex.schema.createTable('balance', (table) => {
    table.string('id').primary().index();
    table.float('balance').notNullable();
    table.string('account_id').notNullable().references('account.id');
    table.timestamp('date').notNullable();
    table.timestamp('created_at');
    table.unique(['account_id', 'date']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async (knex) => {};
