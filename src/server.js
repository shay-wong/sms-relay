const http = require("node:http");
const fs = require("node:fs");
const { URL } = require("node:url");
const crypto = require("node:crypto");
const { createDedupeStore } = require("./dedupe");
const { buildMessage } = require("./message");

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 3000);
const TOKEN = process.env.TOKEN;
const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES || 64 * 1024);
const DEDUPE_TTL_SECONDS = Number(process.env.DEDUPE_TTL_SECONDS || 120);
const dedupe = createDedupeStore({ ttlMs: DEDUPE_TTL_SECONDS * 1000 });

function loadMessageTemplate() {
  if (process.env.MESSAGE_TEMPLATE_FILE) {
    return fs.readFileSync(process.env.MESSAGE_TEMPLATE_FILE, "utf8");
  }

  return process.env.MESSAGE_TEMPLATE || "";
}

const MESSAGE_TEMPLATE = loadMessageTemplate();

if (!TOKEN) {
  console.error("TOKEN is required");
  process.exit(1);
}

function safeEqual(a, b) {
  const aa = Buffer.from(a || "");
  const bb = Buffer.from(b || "");
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
        reject(new Error("body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function forwardToOpeniLink(text) {
  if (!process.env.OPENILINK_URL || !process.env.OPENILINK_APP_TOKEN) {
    return { type: "log-only" };
  }

  const endpoint = new URL("/bot/v1/message/send", process.env.OPENILINK_URL);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENILINK_APP_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      to: process.env.OPENILINK_TO,
      type: "text",
      content: text
    })
  });

  return {
    type: "openilink",
    status: response.status,
    body: await response.text()
  };
}

function writeJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/health") {
      writeJson(res, 200, { ok: true });
      return;
    }

    if (req.method !== "POST" || url.pathname !== "/sms") {
      res.writeHead(404);
      res.end("not found");
      return;
    }

    const queryToken = url.searchParams.get("token");
    const bearerToken = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!safeEqual(queryToken, TOKEN) && !safeEqual(bearerToken, TOKEN)) {
      res.writeHead(401);
      res.end("unauthorized");
      return;
    }

    const raw = await readBody(req);
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { content: raw };
    }

    const message = buildMessage(data, raw, { template: MESSAGE_TEMPLATE });
    const duplicate = dedupe.check(message);
    console.log(JSON.stringify({
      at: new Date().toISOString(),
      info: message.info,
      recipient: message.recipient,
      sender: message.sender,
      name: message.name,
      contentLength: message.content.length,
      duplicate: duplicate.duplicate
    }));

    if (duplicate.duplicate) {
      writeJson(res, 200, {
        ok: true,
        duplicate: true,
        forward: {
          type: "deduplicated",
          expiresInSeconds: Math.ceil(duplicate.expiresInMs / 1000)
        }
      });
      return;
    }

    const forward = await forwardToOpeniLink(message.text);
    writeJson(res, 200, { ok: true, forward });
  } catch (error) {
    console.error(error);
    res.writeHead(500);
    res.end("internal error");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`sms-relay listening on ${HOST}:${PORT}`);
});
