import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countLabel, pagination, nouns } from '../client/pagination.js';

test('pagination uses contextual nouns for zero, singular and plural counts', () => {
  for (const [context, [singular, plural]] of Object.entries(nouns)) {
    assert.equal(countLabel(0, context), `0 ${plural}`); assert.equal(countLabel(1, context), `1 ${singular}`); assert.equal(countLabel(150, context), `150 ${plural}`);
  }
});

test('shared pagination preserves page bounds and payment controls', () => {
  const customers = pagination({ total: 150, page: 1, limit: 20 }, 'customers');
  assert.match(customers, /150 customers · Page 1 of 8/); assert.match(customers, /id="previous" disabled/); assert.doesNotMatch(customers, /id="next" disabled/);
  assert.match(pagination({ total: 200, page: 10, limit: 20 }, 'orders'), /id="next" disabled/);
  assert.match(pagination({ total: 0, page: 1, limit: 20 }, 'products'), /0 items · Page 1 of 1/);
  assert.match(pagination({ total: 21, page: 2, limit: 20 }, 'payments', 'payment-prev', 'payment-next'), /21 payments · Page 2 of 2/);
});
