import { Router } from "../deps.ts";
import * as wsController from "../controllers/ws.controller.ts";

const router = new Router();

router.get("/ws", wsController.handleWebSocket);

export default router;
