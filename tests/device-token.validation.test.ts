import assert from "node:assert/strict";
import test from "node:test";
import {
  deviceTokenSchema,
  removeDeviceTokenSchema,
} from "../src/api/v1/users/device-token.validation.js";

const token = "fcm-device-token-1234567890";

test("device token registration accepts supported platforms", () => {
  const result = deviceTokenSchema.parse({ token, platform: "ANDROID" });
  assert.equal(result.token, token);
  assert.equal(result.platform, "ANDROID");
  assert.equal(deviceTokenSchema.safeParse({ token, platform: "WINDOWS" }).success, false);
  assert.equal(deviceTokenSchema.safeParse({ token, platform: "ANDROID", extra: true }).success, false);
});

test("device token removal rejects malformed payloads", () => {
  assert.equal(removeDeviceTokenSchema.safeParse({ token }).success, true);
  assert.equal(removeDeviceTokenSchema.safeParse({ token: "short" }).success, false);
  assert.equal(removeDeviceTokenSchema.safeParse({ token, platform: "IOS" }).success, false);
});
