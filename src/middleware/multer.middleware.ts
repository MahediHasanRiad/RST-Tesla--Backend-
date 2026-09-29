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
    if (!avatarMimeTypes.has(file.mimetype))
      return callback(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
    callback(null, true);
  },
});

export const vehicleUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.AVATAR_MAX_BYTES, files: 5, fields: 4, parts: 9 },
  fileFilter: (_request, file, callback) => {
    if (!avatarMimeTypes.has(file.mimetype))
      return callback(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
    callback(null, true);
  },
});
