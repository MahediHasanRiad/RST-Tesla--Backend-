import assert from "node:assert/strict";
import test from "node:test";
import {
  createCursorPage,
  decodeCursor,
  encodeCursor,
  parseCursorQuery,
} from "../src/shared/pagination/cursor.js";
import { buildListCacheKey } from "../src/shared/cache/cache-aside.js";

const firstPosition = {
  createdAt: "2026-09-29T00:00:00.000Z",
  id: "550e8400-e29b-41d4-a716-446655440000",
};

test("cursor pagination defaults and round-trips opaque positions", () => {
  const query = parseCursorQuery({});
  assert.equal(query.limit, 20);
  assert.equal(query.position, undefined);

  const cursor = encodeCursor(firstPosition);
  assert.deepEqual(decodeCursor(cursor), firstPosition);
  assert.deepEqual(parseCursorQuery({ cursor, limit: "10" }).position, firstPosition);
  assert.equal(parseCursorQuery({ cursor, limit: "10" }).limit, 10);
});

test("cursor pagination rejects malformed and over-limit input", () => {
  assert.throws(() => parseCursorQuery({ cursor: "invalid" }), /invalid_cursor/);
  assert.throws(() => parseCursorQuery({ limit: "101" }));
  assert.throws(() => parseCursorQuery({ limit: "0" }));
});

test("cursor page metadata reports continuation", () => {
  const items = [{ id: firstPosition.id }];
  const page = createCursorPage(items, 1, true, () => firstPosition);
  assert.equal(page.hasNextPage, true);
  assert.equal(page.nextCursor, encodeCursor(firstPosition));

  const lastPage = createCursorPage(items, 1, false, () => firstPosition);
  assert.equal(lastPage.nextCursor, null);
});

test("list cache keys isolate cursor and limit values", () => {
  const first = buildListCacheKey("service-zones", { cursor: null, limit: 20 });
  const second = buildListCacheKey("service-zones", {
    cursor: encodeCursor(firstPosition),
    limit: 20,
  });
  const differentLimit = buildListCacheKey("service-zones", { cursor: null, limit: 10 });

  assert.notEqual(first, second);
  assert.notEqual(first, differentLimit);
});
