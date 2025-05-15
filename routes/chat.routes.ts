import { Router } from "../deps.ts";
import * as chatController from "../controllers/chat.controller.ts";
import { authMiddleware } from "../middleware/auth.middleware.ts";

const router = new Router();

router.use(authMiddleware);

router
  .get("/chats", chatController.getChats)
  .get("/chats/:id/messages", chatController.getMessages)
  .post("/chats/personal", chatController.createOrGetPersonalChat)
  .post("/chats/group", chatController.createNewGroupChat)
  .post("/chats/:id/members", chatController.addUserToGroup)
  .post("/chats/:id/messages", chatController.sendMessage)
  .post("/messages/:id/read", chatController.markMessageRead)
  .get("/chats/global", chatController.getGlobalChat)
  .get("/chats/global/stats", chatController.getGlobalChatStats);

export default router;
