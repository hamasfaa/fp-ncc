import { Router } from "../deps.ts";
import * as authController from "../controllers/auth.controller.ts";

const router = new Router();

router
  .post("/register", authController.register)
  .post("/login", authController.login)
  .post("/logout", authController.logout);

export default router;
