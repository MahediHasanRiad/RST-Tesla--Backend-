import assert from "node:assert/strict";
import test from "node:test";
import { cacheAside } from "../src/shared/cache/cache-aside.js";
import { redis } from "../src/lib/redis.js";

type RedisStub = {
  get: (key: string) => Promise<string | null>;
  set: (...args: unknown[]) => Promise<unknown>;
};

const redisStub = redis as unknown as RedisStub;

function withRedisStubs(
  get: RedisStub["get"],
  set: RedisStub["set"],
  callback: () => Promise<void>,
) {
  const originalGet = redisStub.get;
  const originalSet = redisStub.set;
  redisStub.get = get;
  redisStub.set = set;
  return callback().finally(() => {
    redisStub.get = originalGet;
    redisStub.set = originalSet;
  });
}

test("cacheAside returns a cache hit without calling the loader", async () => {
  let loads = 0;
  await withRedisStubs(
    async () => JSON.stringify({ items: ["cached"] }),
    async () => undefined,
    async () => {
      const result = await cacheAside("test:hit", async () => {
        loads += 1;
        return { items: ["database"] };
      });
      assert.deepEqual(result, { items: ["cached"] });
      assert.equal(loads, 0);
    },
  );
});

test("cacheAside loads on a miss and writes with a bounded TTL", async () => {
  let setArgs: unknown[] = [];
  await withRedisStubs(
    async () => null,
    async (...args) => {
      setArgs = args;
    },
    async () => {
      const result = await cacheAside("test:miss", async () => ({ items: ["database"] }), 60);
      assert.deepEqual(result, { items: ["database"] });
      assert.deepEqual(setArgs, ["test:miss", JSON.stringify(result), "EX", 60]);
    },
  );
});

test("cacheAside treats malformed cached JSON as a miss", async () => {
  let loads = 0;
  await withRedisStubs(
    async () => "{malformed",
    async () => undefined,
    async () => {
      const result = await cacheAside("test:malformed", async () => {
        loads += 1;
        return { items: ["database"] };
      });
      assert.deepEqual(result, { items: ["database"] });
      assert.equal(loads, 1);
    },
  );
});

test("cacheAside falls back to the loader when Redis operations fail", async () => {
  await withRedisStubs(
    async () => {
      throw new Error("redis unavailable");
    },
    async () => {
      throw new Error("redis unavailable");
    },
    async () => {
      const result = await cacheAside("test:fallback", async () => ({ ok: true }));
      assert.deepEqual(result, { ok: true });
    },
  );
});
