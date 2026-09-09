import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import * as passwordResetController from "../controllers/password-reset.controller.js";

const router = Router();

router.post("/login", authController.login);
router.post("/logout", authController.logout);
router.get("/me", authController.me);
router.post("/forgot-password", passwordResetController.forgotPassword);
router.get("/reset-password/:token", passwordResetController.checkResetToken);
router.post("/reset-password/:token", passwordResetController.resetPassword);

export default router;
