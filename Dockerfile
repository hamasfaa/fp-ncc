FROM denoland/deno:latest

WORKDIR /app

RUN mkdir -p /app/uploads

COPY deno.json .
COPY deps.ts .

COPY . .

RUN chown -R deno:deno /app

USER deno

RUN deno cache --config=deno.json deps.ts

RUN deno cache --config=deno.json main.ts

EXPOSE 8000

CMD ["deno", "run", "--allow-net", "--allow-read", "--allow-write", "--allow-env", "main.ts"]