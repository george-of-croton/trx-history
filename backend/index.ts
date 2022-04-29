/* eslint-disable no-underscore-dangle */
import _ from "lodash";
import fs from "fs";
import path from "path";
import { getKnex, logger, post, uuid, wait } from "./lib";

const API_BASE_URL = "https://api.trongrid.io";

// blocks from dec 31 of each year

const _2020 = [2020, 26363366];
const _2021 = [2021, 36795624];

const years = [_2020, _2021];

// const getAccountFirstTransaction = async (account: string) => {
//   const transactions = await get(
//     `${API_BASE_URL}/v1/accounts/${account}/transactions?limit=1&order_by=block_timestamp%2Casc`
//   );

//   const [trx] = transactions.data;

//   return trx;
// };

const getAccountInfoAtLedger = async (account: string, block: number) => {
  try {
    const blockData = await post(`${API_BASE_URL}/wallet/getblockbynum`, {
      num: block,
    });

    const accountResult = await post(
      `http://161.117.83.38:8090/wallet/getaccountbalance`,
      {
        account_identifier: {
          address: account,
        },
        block_identifier: {
          hash: blockData.blockID,
          number: block,
        },
        visible: true,
      }
    );

    const data = {
      date: new Date(blockData.block_header.raw_data.timestamp),
      balance: accountResult.balance,
      account,
      block,
    };

    return data;
  } catch (e) {
    logger.warn("error_fetching_balance");
    return null;
  }
};

export const insertBalanceRow = async (accountInfo: any) => {
  const knex = await getKnex();
  await knex("balance").insert({
    id: uuid(),
    date: accountInfo.date,
    account: accountInfo.account,
    block: accountInfo.block,
    balance: accountInfo.balance,
    created_at: new Date(),
  });
};

const oneDayInLedgers = 28800;

const getNextBalance = async () => {
  const knex = await getKnex();

  const [previousRecord] = await knex("balance")
    .orderBy("date", "desc")
    .limit(1);

  if (previousRecord.date + 1000 * 60 * 60 * 24 > Date.now()) {
    logger.info("balance records up to date");
    await wait(1000 * 60);
  }
  const nextLedger = previousRecord.block + oneDayInLedgers;
  const accountInfo = await getAccountInfoAtLedger(
    previousRecord.account,
    nextLedger
  );

  await insertBalanceRow(accountInfo);

  // const datapoints = await knex("balance").orderBy("date", "desc").limit(50);
  // console.clear();
  // console.log(
  //   plot(datapoints.map(({ balance }) => balance).reverse(), { height: 20 })
  // );
  await getNextBalance();
};

export const parseCsv: (csv: string) => string[] = _.flow([
  // remove headings
  (data) => _.split(data, "\n"),
  (data) => _.drop(data, 1),
  (data) => _.map(data, (data) => _.split(data, ",")),
]);

const ADDRESS_FILE = "address.csv";

const loadAddresses = async () => {
  const knex = await getKnex();
  const csvStr = fs.readFileSync(path.join(__dirname, ADDRESS_FILE), "utf-8");
  const csvRows = parseCsv(csvStr);
  for (const chunk of _.chunk(csvRows, 1000)) {
    await knex("account")
      .insert(
        chunk.map(([address, createdAt]) => ({
          id: uuid(),
          address,
          created_at: new Date(createdAt),
        }))
      )
      .onConflict("address")
      .ignore();
  }
};

const start = async () => {
  console.log("here");
  const knex = await getKnex();
  const [, , load = true] = process.argv;

  if (load) {
    await loadAddresses();
  }

  for (const [year, block] of years) {
    let next = true;
    let page = 0;
    while (next) {
      const accounts = await knex("account")
        .whereRaw("created_at <= make_date(?, ?, ?)", [year, 12, 31])
        .whereNotIn(
          "id",
          knex("balance")
            .whereRaw("date =  make_date(?, ?, ?)", [year, 12, 31])
            .select("account_id")
        )
        .limit(1000)
        .offset(page * 1000)
        .orderBy("address", "desc");

      if (_.isEmpty(accounts)) {
        next = false;
        break;
      } else {
        // eslint-disable-next-line no-plusplus
        page++;
      }

      const [{ date }] = (
        await knex.raw("select make_date as date from make_date(?, ?, ?)", [
          year,
          12,
          31,
        ])
      ).rows;

      for (const account of accounts) {
        const balance = await getAccountInfoAtLedger(account.address, block);
        if (balance) {
          await knex("balance")
            .insert({
              id: uuid(),
              account_id: account.id,
              balance: balance.balance,
              date,
              created_at: new Date(),
            })
            .onConflict(["account_id", "date"])
            .ignore();
        }
      }
    }
  }
};

start();
