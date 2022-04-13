/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async (knex) => {
  await knex.schema.createTable('balance', (table) => {
    table.string('id').primary().index();
    table.float('balance').notNullable();
    table.integer('block').notNullable();
    table.string('account').notNullable();
    table.timestamp('date').notNullable();
    table.timestamp('created_at');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async (knex) => {};
