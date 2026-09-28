import multer from "multer";
import { env } from "../config/env.js";

const avatarMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.AVATAR_MAX_BYTES,
    files: 1,
    fields: 5,
    parts: 6,
  },
  fileFilter: (_request, file, callback) => {
    callback(null, avatarMimeTypes.has(file.mimetype));
  },
});
