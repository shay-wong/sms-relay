function firstValue(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value);
    if (text.length > 0) return text;
  }
  return "";
}

function buildMessage(data, raw = "") {
  const info = firstValue(data.info, data.type, data["信息"]);
  const content = firstValue(data.content, data.text, data.message, data.body, data["内容"], raw);
  const recipient = firstValue(data.recipient, data.to, data.receiver, data["收件人"]);
  const sender = firstValue(data.sender, data.from, data.phone, data["发件人"]);
  const name = firstValue(data.name, data.title, data["名称"]);

  const lines = [
    ["信息", info],
    ["内容", content],
    ["收件人", recipient],
    ["发件人", sender],
    ["名称", name]
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`);

  const text = ["短信转发", ...lines].join("\n");

  return {
    info,
    content,
    recipient,
    sender,
    name,
    text
  };
}

module.exports = {
  firstValue,
  buildMessage
};
