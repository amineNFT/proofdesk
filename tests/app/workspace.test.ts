import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterWorkspace, restoreDrafts } from '../../lib/workspace.ts';
import { newDraft, type Job } from '../../lib/proofdesk.ts';
import { sampleJob } from '../fixtures/samples.ts';
const owner = '0x1111111111111111111111111111111111111111';
const researcher = '0x2222222222222222222222222222222222222222';
const draft = newDraft(
  'SQLite licensing brief',
  ['Explain the license requirements.'],
  '',
  7,
  '0',
);
const posted: Job = {
  ...draft,
  id: 'posted',
  origin: 'chain',
  owner,
  researcher,
};
void test('a fresh workspace is empty and samples never appear in either view', () => {
  assert.deepEqual(filterWorkspace([], '', 'mine', ''), []);
  assert.deepEqual(filterWorkspace([sampleJob()], '', 'all', ''), []);
  assert.deepEqual(restoreDrafts([sampleJob()]), []);
});
void test('my briefs includes local drafts and work owned or assigned to the selected wallet', () => {
  assert.equal(filterWorkspace([draft, posted], '', 'mine', '').length, 1);
  assert.equal(filterWorkspace([draft, posted], owner, 'mine', '').length, 2);
  assert.equal(
    filterWorkspace([draft, posted], researcher, 'mine', '').length,
    2,
  );
  assert.equal(filterWorkspace([draft, posted], '', 'all', '').length, 2);
  assert.equal(
    filterWorkspace([posted], owner, 'mine', '  SQLITE  ').length,
    1,
  );
});
void test('draft restoration rejects malformed records and never restores a fabricated approval', () => {
  assert.deepEqual(restoreDrafts(null), []);
  assert.deepEqual(restoreDrafts([{ ...draft, title: 42 }]), []);
  assert.deepEqual(
    restoreDrafts([
      {
        ...draft,
        claims: [
          {
            text: 'Invalid source URL in stored data',
            url: 'javascript:alert(1)',
          },
        ],
      },
    ]),
    [],
  );
  const [restored] = restoreDrafts([
    {
      ...draft,
      status: 'approved',
      paid: true,
      review: { decision: 'approved' },
    },
  ]);
  assert.equal(restored.status, 'open');
  assert.equal(restored.review, null);
  assert.equal(restored.paid, false);
});
