import { createClient, createAccount } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { TransactionStatus, TransactionHashVariant } from 'genlayer-js/types';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const deployment = JSON.parse(await readFile('lib/deployment.json', 'utf8'));
if (!deployment.contract) throw new Error('Deploy the contract first.');
const account = createAccount(
  (await readFile('.keys/studio.key', 'utf8')).trim(),
);
const client = createClient({ chain: studionet, account });
let run;
try {
  run = JSON.parse(await readFile('.keys/studio-test-state.json', 'utf8'));
} catch {
  run = { jobId: `proofdesk-demo-${Date.now()}`, steps: {} };
}
await mkdir('docs/evidence', { recursive: true });
async function persist() {
  await writeFile('.keys/studio-test-state.json', JSON.stringify(run, null, 2));
}
async function step(name, functionName, args) {
  let entry = run.steps[name];
  if (!entry) {
    entry = {
      hash: await client.writeContract({
        address: deployment.contract,
        functionName,
        args,
        value: 0n,
        leaderOnly: false,
      }),
    };
    run.steps[name] = entry;
    await persist();
    console.log(`${name} submitted: ${entry.hash}`);
  }
  if (entry.complete) {
    console.log(`${name}: already finalized`);
    return;
  }
  const receipt = await client.waitForTransactionReceipt({
    hash: entry.hash,
    status: TransactionStatus.FINALIZED,
    interval: 5000,
    retries: 24,
  });
  const leader = receipt.consensus_data?.leader_receipt
    ?.filter((r) => r.mode === 'leader')
    .at(-1);
  if (
    leader?.execution_result !== 'SUCCESS' &&
    receipt.txExecutionResultName !== 'FINISHED_WITH_RETURN'
  ) {
    await writeFile(
      `artifacts/${name}-receipt.json`,
      JSON.stringify(receipt, null, 2),
    );
    throw new Error(
      `${name} did not execute successfully. Receipt saved for inspection.`,
    );
  }
  entry.complete = true;
  entry.status = receipt.statusName ?? receipt.status;
  await persist();
  console.log(`${name}: finalized successfully`);
}
const source = 'https://www.sqlite.org/copyright.html';
await step('create', 'create_brief', [
  run.jobId,
  'Check the SQLite commercial license',
  JSON.stringify([
    'State whether the SQLite deliverable library requires a paid commercial license.',
  ]),
  account.address,
  7,
]);
await step('submit-incorrect', 'submit_report', [
  run.jobId,
  JSON.stringify([
    {
      text: 'The SQLite deliverable library requires a paid license for commercial use.',
      url: source,
    },
  ]),
]);
await step('review-incorrect', 'review_report', [run.jobId]);
let first = JSON.parse(
  String(
    await client.readContract({
      address: deployment.contract,
      functionName: 'get_revision',
      args: [run.jobId, 1],
      transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
    }),
  ),
);
console.log(`Incorrect claim decision: ${first.status}`);
if (first.status !== 'needs_revision')
  throw new Error(`Expected needs_revision; got ${first.status}.`);
await step('submit-corrected', 'submit_report', [
  run.jobId,
  JSON.stringify([
    {
      text: 'SQLite states that its deliverable library is in the public domain and does not require a license.',
      url: source,
    },
  ]),
]);
await step('review-corrected', 'review_report', [run.jobId]);
const corrected = JSON.parse(
  String(
    await client.readContract({
      address: deployment.contract,
      functionName: 'get_brief',
      args: [run.jobId],
      transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
    }),
  ),
);
console.log(`Corrected claim decision: ${corrected.status}`);
if (corrected.status !== 'approved')
  throw new Error(`Expected approved; got ${corrected.status}.`);
await step('claim-zero-budget', 'claim_payout', [run.jobId]);
const final = JSON.parse(
  String(
    await client.readContract({
      address: deployment.contract,
      functionName: 'get_brief',
      args: [run.jobId],
      transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
    }),
  ),
);
if (final.status !== 'paid' || !final.paid)
  throw new Error('Payment-claim state did not persist.');
await writeFile(
  'docs/evidence/studio-run.json',
  JSON.stringify(
    {
      network: 'studionet',
      contract: deployment.contract,
      testAccount: account.address,
      jobId: run.jobId,
      transactions: run.steps,
      incorrect: first,
      corrected,
      final,
      notes: 'Zero-budget integration. No token transfer was tested.',
    },
    null,
    2,
  ) + '\n',
);
console.log(
  'Studio integration passed; evidence saved to docs/evidence/studio-run.json.',
);
