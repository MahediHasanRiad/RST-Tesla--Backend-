import test from "node:test";
import assert from "node:assert/strict";
import { registerSchema } from "../src/api/v1/auth/auth.validation.js";

const valid = {
  name: "Nusrat Rahman",
  email: "NUSRAT@example.com",
  phone: "+8801712345678",
  password: "StrongPassword1",
  role: "PASSENGER",
};
test("registration normalizes email and rejects unsafe registration input", () => {
  assert.equal(registerSchema.parse(valid).email, "nusrat@example.com");
  assert.equal(
    registerSchema.safeParse({ ...valid, role: "ADMIN" }).success,
    false,
  );
  assert.equal(
    registerSchema.safeParse({ ...valid, email: "not-an-email" }).success,
    false,
  );
  assert.equal(
    registerSchema.safeParse({ ...valid, phone: "bad" }).success,
    false,
  );
  assert.equal(
    registerSchema.safeParse({ ...valid, password: "weak" }).success,
    false,
  );
  assert.equal(
    registerSchema.safeParse({ ...valid, extra: true }).success,
    false,
  );
});

test("registration accepts a normalized Multer avatar payload", () => {
  const file = {
    fieldname: "avatar",
    originalname: "profile.png",
    encoding: "7bit",
    mimetype: "image/png",
    size: 8,
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  } as Express.Multer.File;
  const result = registerSchema.safeParse({
    ...valid,
    avatar: { buffer: file.buffer, mimetype: file.mimetype },
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.avatar?.mimetype, "image/png");
    assert.deepEqual(result.data.avatar?.buffer, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
});
