const { URL } = require("node:url");

const DEFAULT_BASE_URL = "https://open.feishu.cn";
const RECEIVE_ID_TYPES = new Set(["open_id", "user_id", "union_id", "email"]);

function createLarkSender(options = {}) {
  const appId = options.appId || "";
  const appSecret = options.appSecret || "";
  const receiveId = options.receiveId || "";
  const receiveIdType = options.receiveIdType || "open_id";
  const baseUrl = options.baseUrl || DEFAULT_BASE_URL;
  const fetchFn = options.fetchFn || globalThis.fetch;
  const now = options.now || Date.now;

  if (!appId || !appSecret || !receiveId) {
    throw new Error("LARK_APP_ID, LARK_APP_SECRET, and LARK_RECEIVE_ID are required");
  }
  if (!RECEIVE_ID_TYPES.has(receiveIdType)) {
    throw new Error(`unsupported LARK_RECEIVE_ID_TYPE: ${receiveIdType}`);
  }

  let tenantToken = "";
  let tenantTokenExpiresAt = 0;

  async function requestJson(url, init) {
    const response = await fetchFn(url, init);
    const responseText = await response.text();
    let data;

    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error(`Feishu API returned invalid JSON (HTTP ${response.status})`);
    }

    if (!response.ok || data.code !== 0) {
      throw new Error(`Feishu API request failed: ${data.code ?? response.status} ${data.msg || "unknown error"}`);
    }

    return data;
  }

  async function getTenantToken() {
    if (tenantToken && now() < tenantTokenExpiresAt) return tenantToken;

    const endpoint = new URL("/open-apis/auth/v3/tenant_access_token/internal", baseUrl);
    const data = await requestJson(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret })
    });

    if (!data.tenant_access_token) {
      throw new Error("Feishu token response did not include tenant_access_token");
    }

    tenantToken = data.tenant_access_token;
    tenantTokenExpiresAt = now() + Math.max(0, Number(data.expire || 7200) - 60) * 1000;
    return tenantToken;
  }

  async function sendText(text) {
    const token = await getTenantToken();
    const endpoint = new URL("/open-apis/im/v1/messages", baseUrl);
    endpoint.searchParams.set("receive_id_type", receiveIdType);

    const data = await requestJson(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify({
        receive_id: receiveId,
        msg_type: "text",
        content: JSON.stringify({ text: String(text) })
      })
    });

    return {
      type: "lark",
      status: 200,
      messageId: data.data?.message_id || ""
    };
  }

  return { sendText };
}

module.exports = {
  createLarkSender
};
