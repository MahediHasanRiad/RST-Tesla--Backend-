import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cloudinary } from "../../lib/cloudinary.js";

const stagingDirectory = join(dirname(fileURLToPath(import.meta.url)), "../../../public/assert");

function extensionForMimeType(mimetype: string = '.png') {
  if (mimetype === "image/jpeg") return ".jpg";
  if (mimetype === "image/png") return ".png";
  if (mimetype === "image/webp") return ".webp";
  throw new Error("Unsupported avatar MIME type");
}

export async function uploadAvatar(buffer: Buffer, mimetype?: string) {
  await mkdir(stagingDirectory, { recursive: true });
  const stagingPath = join(stagingDirectory, `${randomUUID()}${extensionForMimeType(mimetype)}`);
  try {
    await writeFile(stagingPath, buffer, { flag: "wx" });
    const result = await cloudinary.uploader.upload(stagingPath, {
      folder: "dhaka-tesla-pool/avatars",
      resource_type: "image",
    });
    return { url: result.secure_url, publicId: result.public_id };
  } finally {
    await unlink(stagingPath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}

export async function deleteUploadedAvatar(publicId: string) {
  await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
}
