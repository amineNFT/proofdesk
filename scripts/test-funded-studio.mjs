import { createClient, createAccount } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { TransactionStatus, TransactionHashVariant } from 'genlayer-js/types';
import { readFile, writeFile } from 'node:fs/promises';
const deployment = JSON.parse(await readFile('lib/deployment.json', 'utf8'));
const account = createAccount(
  (await readFile('.keys/studio.key', 'utf8')).trim(),
);
const client = createClient({ chain: studionet, account });
let run;
try {
  run = JSON.parse(await readFile('.keys/funded-test-state.json', 'utf8'));
} catch {
  run = { jobId: `proofdesk-funded-${Date.now()}`, steps: {} };
}
async function save() {
  await writeFile('.keys/funded-test-state.json', JSON.stringify(run, null, 2));
}
if (!run.funded) {
  console.log('Funding the new test account with simulator-only units.');
  await client.request({
    method: 'sim_fundAccount',
    params: [account.address, 1000000],
  });
  run.funded = true;
  await save();
}
console.log(
  `Test account balance: ${await client.getBalance({ address: account.address })}`,
);
async function step(name, args, value = 0n) {
  let entry = run.steps[name];
  if (!entry) {
    entry = {
      hash: await client.writeContract({
        address: deployment.contract,
        functionName: name,
        args,
        value,
        leaderOnly: false,
      }),
    };
    run.steps[name] = entry;
    await save();
    console.log(`${name} submitted: ${entry.hash}`);
  }
  if (entry.complete) return;
  const r = await client.waitForTransactionReceipt({
    hash: entry.hash,
    status: TransactionStatus.FINALIZED,
    interval: 5000,
    retries: 24,
  });
  if (
    r.consensus_data?.leader_receipt?.filter((x) => x.mode === 'leader').at(-1)
      ?.execution_result !== 'SUCCESS'
  ) {
    await writeFile(
      `artifacts/funded-${name}.json`,
      JSON.stringify(r, null, 2),
    );
    throw new Error(`${name} failed; receipt saved.`);
  }
  entry.complete = true;
  await save();
  console.log(`${name}: finalized`);
}
await step(
  'create_brief',
  [
    run.jobId,
    'Verify SQLite licensing with a funded test',
    JSON.stringify([
      'State whether the SQLite library requires a paid license.',
    ]),
    account.address,
    7,
  ],
  100n,
);
run.balanceAfterDeposit = String(
  await client.getBalance({ address: account.address }),
);
await save();
await step('submit_report', [
  run.jobId,
  JSON.stringify([
    {
      text: 'SQLite states that its deliverable library is in the public domain and does not require a license.',
      url: 'https://www.sqlite.org/copyright.html',
    },
  ]),
]);
await step('review_report', [run.jobId]);
const approved = JSON.parse(
  String(
    await client.readContract({
      address: deployment.contract,
      functionName: 'get_brief',
      args: [run.jobId],
      transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
    }),
  ),
);
if (approved.status !== 'approved' && approved.status !== 'paid')
  throw new Error(`Funded review is ${approved.status}.`);
await step('claim_payout', [run.jobId]);
const balance = await client.getBalance({ address: account.address });
const record = JSON.parse(
  String(
    await client.readContract({
      address: deployment.contract,
      functionName: 'get_brief',
      args: [run.jobId],
      transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
    }),
  ),
);
const transferObserved = balance === BigInt(run.balanceAfterDeposit) + 100n;
await writeFile(
  'docs/evidence/studio-funded-run.json',
  JSON.stringify(
    {
      network: 'studionet',
      contract: deployment.contract,
      jobId: run.jobId,
      budgetWei: '100',
      transactions: run.steps,
      record,
      balanceAfterDeposit: run.balanceAfterDeposit,
      balanceAfterPayout: String(balance),
      transferObserved,
      note: 'Simulator test units only. Does not establish Bradbury transfer behavior.',
    },
    null,
    2,
  ) + '\n',
);
console.log(
  `Funded state: ${record.status}; transfer observed in balance: ${transferObserved}`,
);
if (!transferObserved) process.exitCode = 2;
