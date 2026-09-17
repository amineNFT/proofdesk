import { createClient, createAccount, generatePrivateKey } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { TransactionStatus, TransactionHashVariant } from 'genlayer-js/types';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
await mkdir('.keys', { recursive: true });
await mkdir('artifacts', { recursive: true });
let key;
try {
  key = (await readFile('.keys/studio.key', 'utf8')).trim();
} catch {
  key = generatePrivateKey();
  await writeFile('.keys/studio.key', key, { mode: 0o600 });
}
const account = createAccount(key);
const client = createClient({ chain: studionet, account });
console.log(`Studio test account: ${account.address}`);
console.log(`RPC chain ID: ${await client.getChainId()}`);
const code = await readFile('contracts/proofdesk.py');
console.log('Validating contract schema...');
const schema = await client.getContractSchemaForCode(new Uint8Array(code));
await writeFile(
  'artifacts/contract-schema.json',
  JSON.stringify(schema, null, 2),
);
console.log('Contract schema validated.');
let pending;
try {
  pending = JSON.parse(await readFile('.keys/deploy-state.json', 'utf8'));
} catch {}
if (!pending) {
  const hash = await client.deployContract({
    code: new Uint8Array(code),
    args: [],
    leaderOnly: false,
  });
  pending = { hash };
  await writeFile('.keys/deploy-state.json', JSON.stringify(pending));
  console.log(`Deployment submitted: ${hash}`);
} else console.log(`Tracking existing deployment: ${pending.hash}`);
const receipt = await client.waitForTransactionReceipt({
  hash: pending.hash,
  status: TransactionStatus.FINALIZED,
  interval: 5000,
  retries: 24,
});
await writeFile(
  'artifacts/studio-deployment-receipt.json',
  JSON.stringify(
    receipt,
    (_, v) => (typeof v === 'bigint' ? v.toString() : v),
    2,
  ),
);
console.log(`Deployment status: ${receipt.statusName ?? receipt.status}`);
const address =
  receipt.data?.contract_address ?? receipt.to_address ?? receipt.recipient;
if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address))
  throw new Error('No deployed contract address; inspect the saved receipt.');
const version = await client.readContract({
  address,
  functionName: 'get_version',
  args: [],
  transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
});
if (version !== 'proofdesk/1.0')
  throw new Error('Deployed contract version check failed.');
const deployment = {
  network: 'studionet',
  contract: address,
  transaction: pending.hash,
};
await writeFile(
  'lib/deployment.json',
  JSON.stringify(deployment, null, 2) + '\n',
);
console.log(`ProofDesk deployed and read back: ${address}`);
