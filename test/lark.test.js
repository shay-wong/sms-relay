const test = require("node:test");
const assert = require("node:assert/strict");
const { createLarkSender } = require("../src/lark");

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body)
  };
}

test("Lark sender obtains a tenant token and sends a private text message", async () => {
  const calls = [];
  const sender = createLarkSender({
    appId: "cli_test",
    appSecret: "secret",
    receiveId: "ou_test",
    fetchFn: async (url, init) => {
      calls.push({ url: String(url), init });
      if (calls.length === 1) {
        return jsonResponse(200, { code: 0, tenant_access_token: "token", expire: 7200 });
      }
      return jsonResponse(200, { code: 0, msg: "success", data: { message_id: "om_test" } });
    }
  });

  const result = await sender.sendText("短信转发\n验证码 123456");

  assert.deepEqual(result, { type: "lark", status: 200, messageId: "om_test" });
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /tenant_access_token\/internal$/);
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    app_id: "cli_test",
    app_secret: "secret"
  });
  assert.match(calls[1].url, /im\/v1\/messages\?receive_id_type=open_id$/);
  assert.equal(calls[1].init.headers.Authorization, "Bearer token");
  assert.deepEqual(JSON.parse(calls[1].init.body), {
    receive_id: "ou_test",
    msg_type: "text",
    content: JSON.stringify({ text: "短信转发\n验证码 123456" })
  });
});

test("Lark sender reuses the cached tenant token", async () => {
  let tokenRequests = 0;
  const sender = createLarkSender({
    appId: "cli_test",
    appSecret: "secret",
    receiveId: "user@example.com",
    receiveIdType: "email",
    fetchFn: async url => {
      if (String(url).includes("tenant_access_token")) {
        tokenRequests += 1;
        return jsonResponse(200, { code: 0, tenant_access_token: "token", expire: 7200 });
      }
      return jsonResponse(200, { code: 0, msg: "success", data: {} });
    }
  });

  await sender.sendText("one");
  await sender.sendText("two");

  assert.equal(tokenRequests, 1);
});

test("Lark sender rejects API failures without exposing credentials", async () => {
  const sender = createLarkSender({
    appId: "cli_test",
    appSecret: "do-not-leak",
    receiveId: "ou_test",
    fetchFn: async () => jsonResponse(400, { code: 99991663, msg: "missing scope" })
  });

  await assert.rejects(
    sender.sendText("test"),
    error => error.message === "Feishu API request failed: 99991663 missing scope"
      && !error.message.includes("do-not-leak")
  );
});
