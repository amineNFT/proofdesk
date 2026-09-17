/**
 * Read-only state dump for a deployed ProofDesk contract.
 *
 * Prints every brief (or one brief plus its reviewed revisions) so contract
 * state can be compared with what the app shows. Signs nothing, sends nothing.
 *
 * Usage: node scripts/inspect-brief.mjs [briefId]
 */
import { readFile } from 'node:fs/promises';
import { createClient } from 'genlayer-js';
import { studioDevnet } from 'genlayer-js/chains';
import { TransactionHashVariant } from 'genlayer-js/types';

const deployment = JSON.parse(await readFile('lib/deployment.json', 'utf8'));
const address = process.env.CONTRACT || deployment.contract;
if (!address) throw new Error('No contract address in lib/deployment.json.');
const client = createClient({ chain: studioDevnet });
const read = (functionName, args = []) =>
  client.readContract({
    address,
    functionName,
    args,
    transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
  });

console.log(`Contract ${address} · ${studioDevnet.name} (chain ${studioDevnet.id})`);
console.log(`Version: ${await read('get_version')}`);

const ids = await read('list_briefs', [0, 30]);
console.log(`Briefs (${ids.length}): ${ids.join(', ') || '(none)'}\n`);

const wanted = process.argv[2] ? [process.argv[2]] : ids;
for (const id of wanted) {
  let brief;
  try {
    brief = JSON.parse(await read('get_brief', [id]));
  } catch (error) {
    console.log(`${id}: unreadable (${error?.message ?? error})`);
    continue;
  }
  console.log(`=== ${id} — "${brief.title}"`);
  console.log(`status=${brief.status} revision=${brief.revision} paid=${brief.paid}`);
  console.log(`owner=${brief.owner} researcher=${brief.researcher}`);
  console.log(`deadline=${new Date(brief.deadline * 1000).toISOString()}`);
  console.log(`criteria=${JSON.stringify(brief.requirements)}`);
  for (const [i, claim] of (brief.claims ?? []).entries()) {
    console.log(`claim[${i}] ${claim.text}\n          ${claim.url}`);
  }
  console.log(`review=${brief.review ? JSON.stringify(brief.review, null, 2) : 'none'}`);
  // Reviewed revisions are recorded under "<id>:<revision>".
  for (let revision = 1; revision <= brief.revision; revision += 1) {
    try {
      const snapshot = JSON.parse(await read('get_revision', [id, revision]));
      console.log(
        `revision ${revision}: status=${snapshot.status} decision=${snapshot.review?.decision ?? 'none'}`,
      );
    } catch {
      console.log(`revision ${revision}: not recorded`);
    }
  }
  console.log('');
}
