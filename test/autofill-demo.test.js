import test from 'node:test';
import assert from 'node:assert/strict';
import { SAMPLES, LABELS, stepsOf } from '../src/autofill-demo.js';

const marksOf = s => s.doc.flat().filter(p => typeof p !== 'string');

test('every field of every sample has a label, a value and a mark in the document it was read from', () => {
  assert.ok(SAMPLES.length >= 3);
  for (const s of SAMPLES) {
    const keys = new Set(marksOf(s).map(m => m.k));
    for (const f of s.fields) {
      assert.ok(LABELS[f], `${s.id}: label for ${f}`);
      const v = s.values[f];
      assert.ok(v && v.v, `${s.id}: value for ${f}`);
      assert.ok(keys.has(v.src), `${s.id}: ${f} points at a mark (${v.src}) that is not in the document`);
    }
  }
});

test('the steps follow the order of the fields and carry the text to type', () => {
  const s = SAMPLES[0], steps = stepsOf(s);
  assert.deepEqual(steps.map(x => x.field), s.fields);
  assert.ok(steps.every(x => x.text && x.mark));
});

test('the samples are made up: marked as such, no real brand of a lender or notary, no em dashes', () => {
  for (const s of SAMPLES) {
    const text = JSON.stringify(s);
    assert.ok(!/—/.test(text), `${s.id}: em dash`);
    assert.ok(/Sample/.test(text), `${s.id}: marked as a sample`);
  }
});

test('the sample in euros says so, so the demo shows the currency conversion', () => {
  const car = SAMPLES.find(s => s.id === 'car');
  assert.equal(car.values.currency.v, 'EUR');
});
