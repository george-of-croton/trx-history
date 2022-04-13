import { fetchEosTransactions } from "..";
import { getKnex } from "../lib";

test("fetches account transactions", async () => {
  await fetchEosTransactions("stakecasino1");
});

afterAll(async () => {
  const knex = await getKnex();
  await knex.destroy();
});
