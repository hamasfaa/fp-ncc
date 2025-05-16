import { Application, oakCors, ensureDir } from "./deps.ts";
import { errorMiddleware } from "./middleware/error.middleware.ts";
import authRoutes from "./routes/auth.routes.ts";
import wsRoutes from "./routes/ws.routes.ts";
import chatRoutes from "./routes/chat.routes.ts";
import userRoutes from "./routes/user.routes.ts";

import config from "./config/config.ts";

await ensureDir(config.fileStorage.uploadDir);

const app = new Application();

app.use(
  oakCors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(errorMiddleware);

app.use(authRoutes.routes());
app.use(authRoutes.allowedMethods());

app.use(wsRoutes.routes());
app.use(wsRoutes.allowedMethods());

app.use(chatRoutes.routes());
app.use(chatRoutes.allowedMethods());

app.use(userRoutes.routes());
app.use(userRoutes.allowedMethods());

app.use((ctx) => {
  ctx.response.status = 404;
  ctx.response.body = { error: "Not found" };
});

console.log(
  `Server running on http://${config.server.host}:${config.server.port}`
);
await app.listen({ port: config.server.port, hostname: config.server.host });
