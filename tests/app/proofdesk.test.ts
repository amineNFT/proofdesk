import { sampleJob, sampleReview } from '../fixtures/samples.ts';
import { test } from 'node:test';
import { errorMessage, walletError } from '../../lib/errors.ts';
import assert from 'node:assert/strict';

void test('wallet errors retain plain-object details and explain recovery', () => {
  assert.equal(
    errorMessage({ message: 'Network RPC rejected' }),
    'Network RPC rejected',
  );
  assert.match(
    walletError({ code: -32002, message: 'pending' }, 'account connection'),
    /already waiting/,
  );
  assert.match(walletError({ code: 4001 }, 'account connection'), /declined/);
  assert.match(
    walletError(
      { code: 4200, message: 'wallet_getSnaps unsupported' },
      'Snap setup',
    ),
    /network switching is unsupported/,
  );
  assert.match(
    walletError({ code: -32603, message: 'RPC unavailable' }, 'network setup'),
    /RPC unavailable/,
  );
  assert.match(errorMessage(null), /try again/);
});
import {
  validateClaims,
  validateBrief,
  parseAmount,
  formatAmount,
  decide,
  receiptMarkdown,
  newDraft,
} from '../../lib/proofdesk.ts';
import { assertSuccess, FinalizedFailure } from '../../lib/receipt.ts';
import type { GenLayerTransaction } from 'genlayer-js/types';

void test('sample scenarios produce correction, approval and abstention', () => {
  assert.equal(sampleReview(sampleJob('flawed')).decision, 'needs_revision');
  assert.equal(sampleReview(sampleJob('corrected')).decision, 'approved');
  assert.equal(sampleReview(sampleJob('unavailable')).decision, 'inconclusive');
});
void test('sample engine refuses arbitrary or edited reports', () => {
  const j = sampleJob();
  j.claims[0].text = 'A fabricated claim from an edited report.';
  assert.throws(() => sampleReview(j));
  assert.throws(() => sampleReview({ ...sampleJob(), origin: 'draft' }));
});
void test('URL authority cannot be escaped and duplicate claims rejected', () => {
  for (const url of [
    'http://www.sqlite.org/',
    'https://www.sqlite.org.evil.com/',
    'https://www.sqlite.org@127.0.0.1/',
    'https://www.sqlite.org:8443/',
    'https://www.sqlite.org/?redirect=evil',
    'https://127.0.0.1/',
    'https://www.sqlite.org\\@evil.com/',
  ])
    assert.throws(() =>
      validateClaims([{ text: 'SQLite is a database library.', url }]),
    );
  const c = {
    text: 'SQLite is a database library.',
    url: 'https://www.sqlite.org/copyright.html',
  };
  assert.throws(() => validateClaims([c, c]));
  assert.equal(validateClaims([c]).length, 1);
});
void test('budget conversion preserves all 18 decimals without floating point', () => {
  for (const value of [
    '0',
    '25',
    '0.000000000000000001',
    '99999999.123456789123456789',
  ])
    assert.equal(formatAmount(parseAmount(value).toString()), value);
  for (const value of ['-1', '1e18', 'NaN', '1.1234567891234567890'])
    assert.throws(() => parseAmount(value));
});
void test('brief bounds prevent invalid contract inputs', () => {
  assert.throws(() => validateBrief('short', ['Proper requirement'], '', 7));
  assert.throws(() =>
    validateBrief('Database research', ['Proper requirement'], '0x0', 7),
  );
  assert.throws(() =>
    validateBrief('Database research', ['Proper requirement'], '', 31),
  );
  const draft = newDraft(
    'Database research',
    ['Describe PostgreSQL license terms.'],
    '',
    7,
    '0',
  );
  assert.equal(draft.origin, 'draft');
  assert.equal(draft.review, null);
});
void test('empty evidence is never an approval', () => {
  assert.equal(decide([], []), 'inconclusive');
});
void test('export marks samples as illustrative and never invents a hash', () => {
  const text = receiptMarkdown(sampleJob());
  assert.match(text, /Illustrative sample, not a network verdict/);
  assert.doesNotMatch(text, /0x[a-f0-9]{64}/);
});
void test('Studio numeric finality and execution result are both checked', () => {
  const r = {
    status: 7,
    consensus_data: {
      leader_receipt: [
        { mode: 'leader', execution_result: 'SUCCESS' },
        { mode: 'validator', execution_result: 'ERROR' },
      ],
    },
  } as GenLayerTransaction;
  assert.doesNotThrow(() => assertSuccess(r));
  assert.throws(() => assertSuccess({ ...r, status: 6 }));
  assert.throws(
    () => assertSuccess({ status: 7 } as GenLayerTransaction),
    FinalizedFailure,
  );
  assert.throws(
    () =>
      assertSuccess({
        ...r,
        txExecutionResultName: 'FINISHED_WITH_ERROR',
      } as GenLayerTransaction),
    FinalizedFailure,
  );
});
