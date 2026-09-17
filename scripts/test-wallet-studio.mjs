// Tests the app's EIP-1193 signing path, not a browser-extension UI.
import { readFile, writeFile } from 'node:fs/promises';
import { createAccount, createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { walletClient, send, track, readJob } from '../lib/chain.ts';
const deployment = JSON.parse(await readFile('lib/deployment.json', 'utf8'));
const config = { network: 'studionet', contract: deployment.contract };
const account = createAccount(
  (await readFile('.keys/studio.key', 'utf8')).trim(),
);
const rpc = createClient({ chain: studionet });
const methods = new Set();
const chainId = `0x${studionet.id.toString(16)}`;
const provider = {
  request: async ({ method, params }) => {
    methods.add(method);
    if (method === 'eth_accounts' || method === 'eth_requestAccounts')
      return [account.address];
    if (method === 'eth_chainId') return chainId;
    if (method === 'eth_sendTransaction') {
      const tx = params[0];
      if (
        tx.from.toLowerCase() !== account.address.toLowerCase() ||
        BigInt(tx.chainId) !== BigInt(studionet.id)
      )
        throw new Error('Wrong signer or chain');
      const serializedTransaction = await account.signTransaction({
        to: tx.to,
        data: tx.data,
        value: BigInt(tx.value ?? '0x0'),
        nonce: Number(BigInt(tx.nonce)),
        gas: BigInt(tx.gas),
        gasPrice: BigInt(tx.gasPrice),
        chainId: studionet.id,
        type: 'legacy',
      });
      return rpc.sendRawTransaction({ serializedTransaction });
    }
    throw new Error(`Unsupported provider method: ${method}`);
  },
};
let run;
try {
  run = JSON.parse(await readFile('.keys/wallet-test-state.json', 'utf8'));
} catch {
  run = { jobId: `proofdesk-wallet-${Date.now()}`, steps: {} };
}
const connected = await walletClient(config, provider);
const session = { provider, address: connected.address };
async function step(action, args) {
  let entry = run.steps[action];
  if (!entry) {
    entry = { hash: await send(config, session, action, args, 0n) };
    run.steps[action] = entry;
    await writeFile(
      '.keys/wallet-test-state.json',
      JSON.stringify(run, null, 2),
    );
    console.log(`${action} submitted: ${entry.hash}`);
  }
  if (!entry.finalized) {
    await track({ hash: entry.hash, action, config, jobId: run.jobId });
    entry.finalized = true;
    await writeFile(
      '.keys/wallet-test-state.json',
      JSON.stringify(run, null, 2),
    );
  }
  console.log(`${action}: finalized successfully`);
}
await step('create_brief', [
  run.jobId,
  'Browser wallet protocol test',
  JSON.stringify([
    'Explain whether the SQLite library requires a paid license for commercial use.',
  ]),
  account.address,
  7,
]);
await step('submit_report', [
  run.jobId,
  JSON.stringify([
    {
      text: "SQLite's deliverable library is dedicated to the public domain and may be used commercially without purchasing a license.",
      url: 'https://www.sqlite.org/copyright.html',
    },
  ]),
]);
await step('review_report', [run.jobId]);
const job = await readJob(config, run.jobId);
if (job.status !== 'approved')
  throw new Error(`Expected approval, got ${job.status}`);
await writeFile(
  'docs/evidence/studio-wallet-run.json',
  JSON.stringify(
    {
      network: 'studionet',
      contract: config.contract,
      jobId: run.jobId,
      validation:
        'Actual app wallet client with an EIP-1193 test signer; no browser extension UI was exercised.',
      completedAt: new Date().toISOString(),
      methods: [...methods],
      steps: run.steps,
      status: job.status,
      review: job.review,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  'Provider signing, submission, and real review passed without Snap requests.',
);
