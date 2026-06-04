const test = require("node:test");
const assert = require("node:assert/strict");
const { buildMessage, firstValue } = require("../src/message");

test("firstValue returns the first non-empty value", () => {
  assert.equal(firstValue(undefined, null, "", 0, "next"), "0");
});

test("buildMessage maps English keys", () => {
  const message = buildMessage({
    info: "sms",
    content: "验证码 123456",
    recipient: "iPhone",
    sender: "95588",
    name: "工商银行"
  });

  assert.equal(message.info, "sms");
  assert.equal(message.content, "验证码 123456");
  assert.equal(message.recipient, "iPhone");
  assert.equal(message.sender, "95588");
  assert.equal(message.name, "工商银行");
  assert.match(message.text, /短信转发/);
  assert.match(message.text, /内容: 验证码 123456/);
});

test("buildMessage maps Chinese keys", () => {
  const message = buildMessage({
    "信息": "短信",
    "内容": "验证码 654321",
    "收件人": "我的手机",
    "发件人": "1069",
    "名称": "服务通知"
  });

  assert.equal(message.info, "短信");
  assert.equal(message.content, "验证码 654321");
  assert.equal(message.recipient, "我的手机");
  assert.equal(message.sender, "1069");
  assert.equal(message.name, "服务通知");
});

test("buildMessage falls back to raw content", () => {
  const message = buildMessage({}, "raw sms body");
  assert.equal(message.content, "raw sms body");
  assert.match(message.text, /内容: raw sms body/);
});

test("buildMessage omits empty fields from forwarded text", () => {
  const message = buildMessage({
    content: "验证码 123456",
    sender: "95588"
  });

  assert.equal(message.text, [
    "短信转发",
    "内容: 验证码 123456",
    "发件人: 95588"
  ].join("\n"));
  assert.doesNotMatch(message.text, /信息:/);
  assert.doesNotMatch(message.text, /收件人:/);
  assert.doesNotMatch(message.text, /名称:/);
  assert.doesNotMatch(message.text, /未知/);
});
