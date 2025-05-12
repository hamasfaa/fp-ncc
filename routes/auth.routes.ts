import { Router } from "../deps.ts";
import * as authController from "../controllers/auth.controller.ts";

const router = new Router();

router.post("/register", authController.register);

export default router;
