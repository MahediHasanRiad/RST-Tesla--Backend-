import assert from "node:assert/strict";
import test from "node:test";
import { deleteProfileSchema, updateProfileSchema } from "../src/api/v1/users/user.validation.js";

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test("profile update permits only supported self-profile fields", () => {
  const result = updateProfileSchema.parse({ name: "Nusrat Rahman", phone: "+8801712345678" });
  assert.equal(result.name, "Nusrat Rahman");
  assert.equal(updateProfileSchema.safeParse({ email: "new@example.com" }).success, false);
  assert.equal(updateProfileSchema.safeParse({ name: "Nusrat", extra: true }).success, false);
  assert.equal(updateProfileSchema.safeParse({ phone: "invalid" }).success, false);
  assert.equal(updateProfileSchema.safeParse({}).success, false);
  assert.equal(updateProfileSchema.safeParse({ avatar: undefined }).success, false);
});

test("profile avatar accepts only safe supported image input", () => {
  assert.equal(updateProfileSchema.safeParse({ avatar: { buffer: png, mimetype: "image/png" } }).success, true);
  assert.equal(updateProfileSchema.safeParse({ avatar: { buffer: Buffer.from("unsafe"), mimetype: "image/png" } }).success, false);
  assert.equal(updateProfileSchema.safeParse({ avatar: { buffer: png, mimetype: "image/gif" } }).success, false);
});

test("account deletion requires only a current password", () => {
  assert.equal(deleteProfileSchema.safeParse({ currentPassword: "current-password" }).success, true);
  assert.equal(deleteProfileSchema.safeParse({}).success, false);
  assert.equal(deleteProfileSchema.safeParse({ currentPassword: "x", userId: "other" }).success, false);
});
