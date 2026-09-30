import assert from "node:assert/strict";
import test from "node:test";
import { getClusterWorkerCount } from "../src/runtime/cluster-config.js";
import { configureRedisAdapter } from "../src/worker-server.js";

test("cluster worker count uses CPU cores minus one with a one-worker minimum", () => {
  assert.equal(getClusterWorkerCount(undefined, 8), 7);
  assert.equal(getClusterWorkerCount(undefined, 1), 1);
  assert.equal(getClusterWorkerCount(3, 8), 3);
});

test("Redis adapter failure keeps worker startup in local-worker mode", async () => {
  let adapterConfigured = false;
  const io = {
    adapter() {
      adapterConfigured = true;
    },
  };
  const createFailingClient = () => ({
    duplicate() {
      return this;
    },
    async connect() {
      throw new Error("redis unavailable");
    },
    disconnect() {},
  });

  const clients = await configureRedisAdapter(
    io as never,
    createFailingClient as never,
  );

  assert.equal(clients, undefined);
  assert.equal(adapterConfigured, false);
});

test("Redis adapter is configured when pub/sub clients connect", async () => {
  let adapterConfigured = false;
  const io = {
    adapter() {
      adapterConfigured = true;
    },
  };
  const createConnectedClient = () => ({
    duplicate() {
      return this;
    },
    async connect() {},
    on() {},
    off() {},
    psubscribe() {},
    subscribe() {},
    publish() {},
    async quit() {},
    disconnect() {},
  });

  const clients = await configureRedisAdapter(
    io as never,
    createConnectedClient as never,
  );

  assert.equal(adapterConfigured, true);
  assert.notEqual(clients, undefined);
});
