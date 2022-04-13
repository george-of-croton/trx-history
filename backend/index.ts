import { get, getKnex, logger, post, uuid, wait } from "./lib";

const API_BASE_URL = "https://api.trongrid.io";

const getAccountFirstTransaction = async (account: string) => {
  const transactions = await get(
    `${API_BASE_URL}/v1/accounts/${account}/transactions?limit=1&order_by=block_timestamp%2Casc`
  );

  const [trx] = transactions.data;
  console.log({ trx });
  return trx;
};

const getAccountInfoAtLedger = async (account: string, block: number) => {
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

const start = async () => {
  const knex = await getKnex();
  const [, , account = "TC74QG8tbtixG5Raa4fEifywgjrFs45fNz"] = process.argv;

  const [previousRecord] = await knex("balance")
    .orderBy("date", "desc")
    .limit(1);

  if (!previousRecord) {
    const data = await getAccountFirstTransaction(account);
    console.log({ data });
    const accountInfo = await getAccountInfoAtLedger(account, data.blockNumber);
    await insertBalanceRow(accountInfo);
    console.log({ accountInfo });
  }
  getNextBalance();
};

start();
