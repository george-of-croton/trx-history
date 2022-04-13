import fetch from "node-fetch";
import AbortController from "abort-controller";
import fs from "fs";
import winston from "winston";
import path from "path";
import knex from "knex";
import { v4 } from "uuid";
import { inspect } from "util";
import { LEVEL, SPLAT } from "triple-beam";
import _ from "lodash";

export const logger = winston.createLogger({
  level: "info",
  format: winston.format.printf((info) => {
    const data = _.omit(info, [LEVEL, SPLAT, "message", "level"]);

    const inspectStr = _.keys(data).length
      ? inspect(data, {
          depth: 4,
          colors: process.env.NODE_ENV !== "production",
          breakLength: 100,
        })
      : "";

    const indentStr = inspectStr
      ? inspectStr
          .split(/\n/g)
          .map((line) => `  ${line}`)
          .join("\n")
      : "";

    const dataStr = indentStr ? `\n${indentStr}` : "";

    return `log_${info.level}: ${info.message}${dataStr}`;
  }),
  // defaultMeta: { service: "user-service" },
  transports: [
    //
    // - Write all logs with importance level of `error` or less to `error.log`
    // - Write all logs with importance level of `info` or less to `combined.log`
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
    // new winston.transports.File({ filename: 'error.log', level: 'error' }),
    // new winston.transports.File({ filename: 'combined.log' }),
  ],
});

export const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return String(error);
};

export const logErrorMessage = (desc: string, error: unknown) => {
  logger.error(desc, { erro: getErrorMessage(error) });
};

const httpRequest =
  (method: "get" | "post") =>
  async (url: string, options: { body?: any } = {}) => {
    const ctr = new AbortController();
    const timeout = setTimeout(() => ctr.abort(), 5000);
    try {
      const serializedBody = options.body ? JSON.stringify(options.body) : "";
      const res = await fetch(
        url,
        _.omit(
          {
            method,
            ...options,
            body: serializedBody,
            signal: ctr.signal,
          },
          method === "get" ? "body" : ""
        )
      );
      logger.info(`${method}_${url}`, res.status);
      return res;
    } catch (error: unknown) {
      logErrorMessage(`parse_${url}_failed`, error);
      throw new Error("http_request_error");
    } finally {
      clearTimeout(timeout);
    }
  };

export const get = async (url: string, options = {}) => {
  return JSON.parse(await (await httpRequest("get")(url, options)).text());
};

export const post = async (url: string, body: any, options = {}) => {
  return JSON.parse(
    await (await httpRequest("post")(url, { body, ...options })).text()
  );
};

export const download = async (url: string, filename: string, options = {}) => {
  const res = await httpRequest("get")(url, options);
  return new Promise((resolve, reject) => {
    res.body.pipe(fs.createWriteStream(path.join("/node", filename)));
    res.body.on("end", resolve);
    res.body.on("error", reject);
  });
};

export const replaceAll = (
  string: string,
  search: string | RegExp,
  replace: string
) => {
  let nextString = string;
  while (new RegExp(search).test(nextString)) {
    nextString = nextString.replace(search, replace);
  }
  return nextString;
};

export const once = <T>(fn: () => T) => {
  let exec = false;
  let result: T;
  return () => {
    if (!exec) {
      result = fn();
      exec = true;
    }
    return result;
  };
};

export const wait = async (timeout: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, timeout);
  });

export const getKnex = once(async () => {
  const client = knex({
    client: "pg", // or 'better-sqlite3'
    connection: {
      host: "postgres",
      port: 5432,
      user: "postgres",
      password: "password",
      database: "postgres",
    },
  });

  await client.migrate.latest();
  return client;
});

export const uuid = v4;
