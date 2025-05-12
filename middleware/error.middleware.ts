export const errorMiddleware = async (ctx: Context, next: Next) => {
  try {
    await next();
  } catch (err) {
    const status = err.status || 500;
    const message = err.message || "Internal server error";

    console.error(`Error: ${status} - ${message}`);

    ctx.response.status = status;
    ctx.response.body = {
      error: message,
      status,
      timestamp: new Date().toISOString(),
    };
  }
};
