const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeKenyanPhone } = require('../src/utils');

test('normalizes Kenyan phone formats', () => {
  assert.equal(normalizeKenyanPhone('0712345678'), '+254712345678');
  assert.equal(normalizeKenyanPhone('+254712345678'), '+254712345678');
  assert.equal(normalizeKenyanPhone('0112345678'), '+254112345678');
});

test('rejects invalid phone numbers', () => {
  assert.equal(normalizeKenyanPhone('12345'), null);
  assert.equal(normalizeKenyanPhone('+15551234567'), null);
});
