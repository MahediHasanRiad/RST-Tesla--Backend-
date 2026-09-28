const supportedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function hasExpectedSignature(buffer: Buffer, mimetype: string) {
  if (mimetype === "image/jpeg")
    return buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  if (mimetype === "image/png")
    return buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

export function isValidAvatar(buffer: Buffer, mimetype: string) {
  return supportedMimeTypes.has(mimetype) && hasExpectedSignature(buffer, mimetype);
}
