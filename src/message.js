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

  const text = [
    "短信转发",
    `信息: ${info || "未知"}`,
    `内容: ${content || "未知"}`,
    `收件人: ${recipient || "未知"}`,
    `发件人: ${sender || "未知"}`,
    `名称: ${name || "未知"}`
  ].join("\n");

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
