import { Router } from "../deps.ts";
import * as userController from "../controllers/user.controller.ts";
import { authMiddleware } from "../middleware/auth.middleware.ts";

const router = new Router();
router.use(authMiddleware);

router
  .get("/users", userController.getAllUsers)
  .get("users/search", userController.getUserDetails)
  .get("users/:id", userController.searchUsersCont);

export default router;
