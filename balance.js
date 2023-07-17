"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const redis = require("redis");
const util = require("util");
const KEY = `account1/balance`;
const DEFAULT_BALANCE = 100;

exports.chargeRequestRedis = async function (input) {
    const redisClient = await getRedisClient();
    const charges = input.unit;
    
    const result = await performDecrement(redisClient, KEY, charges);
    await disconnectRedis(redisClient);
    
    const remainingBalance = result.remainingBalance;
    const resultCode = result.resultCode;
    const checkBalanceTime = result.checkBalanceTime;
    if (-1 === resultCode) {
        return {
            remainingBalance,
            checkBalanceTime,
            charges: 0,
            isAuthorized: false,
        };
    };

    return {
        remainingBalance,
        checkBalanceTime,
        charges,
        isAuthorized: true,
    };
};

async function getRedisClient() {
    return new Promise((resolve, reject) => {
        try {
            const client = new redis.RedisClient({
                host: process.env.ENDPOINT,
                port: parseInt(process.env.PORT || "6379"),
            });
            client.on("ready", () => {
                console.log('redis client ready');
                resolve(client);
            });
        }
        catch (error) {
            reject(error);
        }
    });
}

async function disconnectRedis(client) {
    return new Promise((resolve, reject) => {
        client.quit((error, res) => {
            if (error) {
                reject(error);
            }
            else if (res == "OK") {
                console.log('redis client disconnected');
                resolve(res);
            }
            else {
                reject("unknown error closing redis connection.");
            }
        });
    });
}

function performDecrement(client, key, decrementBy) {
  return new Promise((resolve, reject) => {
    // if the current balance is too small, the Lua script returns -1
    const script = `
      redis.replicate_commands() -- Enable command replication for accurate timing
      local start = redis.call('TIME') -- Record the start time
      
      local remainingBalance = tonumber(redis.call('GET', KEYS[1]))
      local modified = remainingBalance - tonumber(ARGV[1])
      
      local finish = redis.call('TIME') -- Record the finish time
      local startSeconds = tonumber(start[1])
      local startMicroseconds = tonumber(start[2])
      local finishSeconds = tonumber(finish[1])
      local finishMicroseconds = tonumber(finish[2])
      local elapsedTimeSeconds = finishSeconds - startSeconds
      local elapsedTimeMicroseconds = finishMicroseconds - startMicroseconds
      local elapsedTimeMilliseconds = elapsedTimeSeconds * 1000 + elapsedTimeMicroseconds / 1000

      if modified < 0 then
        return {remainingBalance, -1, elapsedTimeMilliseconds}
      end
      redis.call('SET', KEYS[1], modified)
      return {modified, 1, elapsedTimeMilliseconds}
    `;

    client.eval(script, 1, key, decrementBy, (error, result) => {
      if (error) {
        reject(error);
      } else {
        const [remainingBalance, resultCode, checkBalanceTime] = result;
        resolve({ remainingBalance, resultCode, checkBalanceTime });
      }
    });
  });
}