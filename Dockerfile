FROM denoland/deno:latest

WORKDIR /app

COPY deno.json* .
COPY deps.ts* .
RUN deno cache --config=deno.json main.ts

COPY . .

RUN mkdir -p ./uploads && chown -R deno:deno /app

USER deno

RUN deno cache --config=deno.json main.ts

EXPOSE 8000

ENV PORT=8000
ENV HOST=0.0.0.0

CMD ["deno" "run", "--allow-net", "--allow-read", "--allow-write", "--allow-env", "main.ts"]