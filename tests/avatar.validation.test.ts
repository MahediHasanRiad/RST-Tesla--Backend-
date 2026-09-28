import assert from "node:assert/strict";
import test from "node:test";
import { isValidAvatar } from "../src/shared/media/avatar.validation.js";

test("avatar validation accepts supported image signatures only", () => {
  assert.equal(
    isValidAvatar(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      "image/png",
    ),
    true,
  );
  assert.equal(isValidAvatar(Buffer.from("not-an-image"), "image/png"), false);
  assert.equal(
    isValidAvatar(Buffer.from([0xff, 0xd8, 0xff]), "image/gif"),
    false,
  );
});
