const test = require("node:test");
const assert = require("node:assert/strict");
const { createDedupeStore, fingerprintMessage } = require("../src/dedupe");

const sms = {
  info: "sms",
  content: "验证码 123456",
  recipient: "iPhone",
  sender: "95588",
  name: "工商银行"
};

test("fingerprintMessage hashes canonical SMS fields", () => {
  assert.equal(fingerprintMessage(sms), fingerprintMessage({ ...sms }));
  assert.notEqual(fingerprintMessage(sms), fingerprintMessage({ ...sms, content: "验证码 654321" }));
});

test("dedupe store marks repeats within the TTL", () => {
  let currentTime = 1000;
  const store = createDedupeStore({
    ttlMs: 120000,
    now: () => currentTime
  });

  assert.equal(store.check(sms).duplicate, false);
  assert.equal(store.check(sms).duplicate, true);

  currentTime += 119999;
  assert.equal(store.check(sms).duplicate, true);

  currentTime += 1;
  assert.equal(store.check(sms).duplicate, false);
});

test("dedupe store does not persist raw SMS text", () => {
  let currentTime = 1000;
  const store = createDedupeStore({
    ttlMs: 120000,
    now: () => currentTime
  });

  store.check(sms);
  currentTime += 120000;
  store.check({ ...sms, content: "another sms" });

  assert.equal(store.size(), 1);
});

test("dedupe can be disabled with zero TTL", () => {
  const store = createDedupeStore({ ttlMs: 0 });

  assert.equal(store.check(sms).duplicate, false);
  assert.equal(store.check(sms).duplicate, false);
});
