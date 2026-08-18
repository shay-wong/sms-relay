const http = require("node:http");
const fs = require("node:fs");
const { URL } = require("node:url");
const crypto = require("node:crypto");
const { createDedupeStore } = require("./dedupe");
const { buildMessage } = require("./message");
const { createLogger } = require("./logger");
const { createLarkSender } = require("./lark");
const { isConfiguredPath, normalizePath, normalizeWebhookPath } = require("./webhook-path");

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 3000);
const TOKEN = process.env.TOKEN;
const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES || 64 * 1024);
const DEDUPE_TTL_SECONDS = Number(process.env.DEDUPE_TTL_SECONDS || 120);
const WEBHOOK_PATH = normalizeWebhookPath(process.env.WEBHOOK_PATH);
const HEALTH_PATH = normalizePath(process.env.HEALTH_PATH, "/health");
const OPENILINK_SEND_PATH = normalizePath(process.env.OPENILINK_SEND_PATH, "/bot/v1/message/send");
const logger = createLogger({ level: process.env.LOG_LEVEL });
const dedupe = createDedupeStore({ ttlMs: DEDUPE_TTL_SECONDS * 1000 });

const larkConfig = {
  appId: process.env.LARK_APP_ID,
  appSecret: process.env.LARK_APP_SECRET,
  receiveId: process.env.LARK_RECEIVE_ID,
  receiveIdType: process.env.LARK_RECEIVE_ID_TYPE,
  baseUrl: process.env.LARK_BASE_URL
};
const larkConfigCount = [larkConfig.appId, larkConfig.appSecret, larkConfig.receiveId].filter(Boolean).length;

if (larkConfigCount > 0 && larkConfigCount < 3) {
  logger.error("LARK_APP_ID, LARK_APP_SECRET, and LARK_RECEIVE_ID must be configured together");
  process.exit(1);
}

const larkSender = larkConfigCount === 3 ? createLarkSender(larkConfig) : null;

function loadMessageTemplate() {
  if (process.env.MESSAGE_TEMPLATE_FILE) {
    return fs.readFileSync(process.env.MESSAGE_TEMPLATE_FILE, "utf8");
  }

  return process.env.MESSAGE_TEMPLATE || "";
}

const MESSAGE_TEMPLATE = loadMessageTemplate();

if (!TOKEN) {
  logger.error("TOKEN is required");
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

  const endpoint = new URL(OPENILINK_SEND_PATH, process.env.OPENILINK_URL);
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

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`OpeniLink request failed: HTTP ${response.status}`);
  }

  return {
    type: "openilink",
    status: response.status,
    body
  };
}

async function forwardMessage(text) {
  if (larkSender) return larkSender.sendText(text);
  return forwardToOpeniLink(text);
}

function writeJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && isConfiguredPath(url.pathname, HEALTH_PATH)) {
      writeJson(res, 200, { ok: true });
      return;
    }

    if (req.method !== "POST" || !isConfiguredPath(url.pathname, WEBHOOK_PATH)) {
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
    logger.info(JSON.stringify({
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

    let forward;
    try {
      forward = await forwardMessage(message.text);
    } catch (error) {
      dedupe.forget(duplicate.fingerprint);
      throw error;
    }
    writeJson(res, 200, { ok: true, forward });
  } catch (error) {
    logger.error(error);
    res.writeHead(500);
    res.end("internal error");
  }
});

server.listen(PORT, HOST, () => {
  logger.info(`sms-relay listening on ${HOST}:${PORT}${WEBHOOK_PATH}`);
});
