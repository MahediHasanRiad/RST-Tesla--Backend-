import { Router } from "express";
import { requireAuth } from "../../../middleware/auth.middleware.js";
import { upload } from "../../../middleware/multer.middleware.js";
import { asyncHandler } from "../../../shared/http/async-handler.js";
import { deleteMyProfileController } from "./controllers/delete-my-profile.controller.js";
import { getMyProfileController } from "./controllers/get-my-profile.controller.js";
import { updateMyProfileController } from "./controllers/update-my-profile.controller.js";
import { registerDeviceTokenController } from "./controllers/register-device-token.controller.js";
import { removeDeviceTokenController } from "./controllers/remove-device-token.controller.js";

export const userRoutes = Router();

userRoutes.get("/me", requireAuth, asyncHandler(getMyProfileController));

userRoutes.patch(
  "/update-profile",
  requireAuth,
  upload.single("avatar"),
  asyncHandler(updateMyProfileController),
);

userRoutes.delete(
  "/delete-profile",
  requireAuth,
  asyncHandler(deleteMyProfileController),
);

userRoutes.post(
  "/me/device-tokens",
  requireAuth,
  asyncHandler(registerDeviceTokenController),
);

userRoutes.delete(
  "/me/device-tokens",
  requireAuth,
  asyncHandler(removeDeviceTokenController),
);
