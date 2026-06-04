function firstValue(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value);
    if (text.length > 0) return text;
  }
  return "";
}

function renderTemplate(template, fields) {
  if (!template) return "";

  return String(template).replace(
    /\{\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)(?:\|([^}]*?))?\s*\}\}\}|\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)(?:\|([^}]*?))?\s*\}\}/g,
    (_, rawKey, rawDefault, escapedKey, escapedDefault) => {
      const key = rawKey || escapedKey;
      const fallback = rawKey ? rawDefault : escapedDefault;
      return fields[key] || (fallback === undefined ? "" : fallback.trim());
    }
  );
}

function formatDefaultMessage(fields) {
  const lines = [
    ["名称", fields.name],
    ["信息", fields.info],
    ["内容", fields.content],
    ["收件人", fields.recipient],
    ["发件人", fields.sender]
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`);

  return ["短信转发", ...lines].join("\n");
}

function extractFields(data, raw = "") {
  const info = firstValue(data.info, data.type, data["信息"]);
  const content = firstValue(data.content, data.text, data.message, data.body, data["内容"], raw);
  const recipient = firstValue(data.recipient, data.to, data.receiver, data["收件人"]);
  const sender = firstValue(data.sender, data.from, data.phone, data["发件人"]);
  const name = firstValue(data.name, data.title, data["名称"]);

  return {
    info,
    content,
    recipient,
    sender,
    name
  };
}

function buildMessage(data, raw = "", options = {}) {
  const fields = extractFields(data, raw);
  const text = options.template
    ? renderTemplate(options.template, fields)
    : formatDefaultMessage(fields);

  return {
    ...fields,
    text
  };
}

module.exports = {
  extractFields,
  firstValue,
  buildMessage,
  renderTemplate
};
