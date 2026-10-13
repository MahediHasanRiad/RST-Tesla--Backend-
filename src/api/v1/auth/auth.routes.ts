import { Router } from "express";
import { requireAuth } from "../../../middleware/auth.middleware.js";
import { changePasswordController } from "./controllers/change-password.controller.js";
import { loginController } from "./controllers/login.controller.js";
import { registerController } from "./controllers/register.controller.js";
import { resendVerificationController } from "./controllers/resend-verification.controller.js";
import { resetPasswordController } from "./controllers/reset-password.controller.js";
import { verifyEmailController } from "./controllers/verify-email.controller.js";
import { asyncHandler } from "../../../shared/http/async-handler.js";
import { upload } from "../../../middleware/multer.middleware.js";
import { forgotPasswordController } from "./controllers/forgot-password.controller.js";



export const authRoutes = Router();

authRoutes.post(
  "/register",
  upload.single("avatar"),
  asyncHandler(registerController),
);
authRoutes.patch("/verify-email", asyncHandler(verifyEmailController));
authRoutes.post(
  "/resend-verification",
  asyncHandler(resendVerificationController),
);
authRoutes.post("/login", asyncHandler(loginController));
authRoutes.post("/forgot-password", asyncHandler(forgotPasswordController));
authRoutes.patch("/reset-password", asyncHandler(resetPasswordController));
authRoutes.patch(
  "/change-password",
  requireAuth,
  asyncHandler(changePasswordController),
);
