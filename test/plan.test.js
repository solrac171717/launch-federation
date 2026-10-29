import test from 'node:test';
import assert from 'node:assert/strict';
import { isSuperadmin, planFor, limitsFor } from '../src/plan.js';

test('superadmin is matched by email, ignoring case and spaces', () => {
  assert.equal(isSuperadmin('carlosmartinezhold@gmail.com'), true);
  assert.equal(isSuperadmin('  CarlosMartinezHold@Gmail.com '), true);
  assert.equal(isSuperadmin('someone@else.com'), false);
  assert.equal(isSuperadmin(''), false);
  assert.equal(isSuperadmin(undefined), false);
});

test('plan label and limits', () => {
  assert.equal(planFor('carlosmartinezhold@gmail.com').key, 'superadmin');
  assert.equal(planFor('x@y.com').key, 'early-access');
  assert.equal(limitsFor('carlosmartinezhold@gmail.com').assets, Infinity);
});
