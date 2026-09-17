import { createClient } from 'genlayer-js';
import { studionet, testnetBradbury } from 'genlayer-js/chains';
import {
  TransactionHashVariant,
  TransactionStatus,
  type CalldataEncodable,
  type TransactionHash,
} from 'genlayer-js/types';
import type { EIP1193Provider } from 'viem';
import { validAddress, type Job, type Claim } from './proofdesk.ts';
import { assertSuccess } from './receipt.ts';
import { walletError } from './errors.ts';
import {
  prepareWallet,
  signingProvider,
  type BrowserProvider,
  type WalletSession,
} from './wallet.ts';

export type NetworkName = 'studionet' | 'testnetBradbury';
export type ChainConfig = { network: NetworkName; contract: string };
export type Pending = {
  hash: `0x${string}`;
  action: string;
  jobId?: string;
  config: ChainConfig;
  reportClaims?: Claim[];
};
export const networks = { studionet, testnetBradbury };
export function readClient(config: ChainConfig) {
  return createClient({ chain: networks[config.network] });
}
export async function walletClient(
  config: ChainConfig,
  provider: BrowserProvider,
  expectedAddress?: string,
) {
  try {
    const address = await prepareWallet(
      provider,
      networks[config.network],
      expectedAddress,
    );
    const client = createClient({
      chain: networks[config.network],
      account: address as `0x${string}`,
      provider: signingProvider(
        { provider, address },
        networks[config.network],
      ) as EIP1193Provider,
    });
    return { client, address };
  } catch (error) {
    throw new Error(walletError(error, 'wallet connection and network setup'));
  }
}
export function requireContract(config: ChainConfig): `0x${string}` {
  if (!validAddress(config.contract))
    throw new Error('Set a deployed ProofDesk contract in Network settings.');
  return config.contract as `0x${string}`;
}
export async function readJob(config: ChainConfig, id: string): Promise<Job> {
  const raw = await readClient(config).readContract({
    address: requireContract(config),
    functionName: 'get_brief',
    args: [id],
    transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
  });
  if (typeof raw !== 'string') throw new Error('Unexpected contract response.');
  const job = JSON.parse(raw);
  if (!job.id || !Array.isArray(job.claims) || !Array.isArray(job.requirements))
    throw new Error('This address did not return a ProofDesk brief.');
  return { ...job, origin: 'chain' };
}
export async function listJobs(
  config: ChainConfig,
  offset = 0,
): Promise<{ jobs: Job[]; hasMore: boolean }> {
  const client = readClient(config);
  const address = requireContract(config);
  const version = await client.readContract({
    address,
    functionName: 'get_version',
    args: [],
    transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
  });
  if (version !== 'proofdesk/1.0')
    throw new Error('The selected contract is not ProofDesk 1.0.');
  const ids = await client.readContract({
    address,
    functionName: 'list_briefs',
    args: [offset, 12],
    transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
  });
  if (!Array.isArray(ids)) throw new Error('Could not read the brief list.');
  return {
    jobs: await Promise.all(
      ids.map((id) => {
        if (typeof id !== 'string')
          throw new Error('Invalid brief ID returned by contract.');
        return readJob(config, id);
      }),
    ),
    hasMore: ids.length === 12,
  };
}
export async function track(pending: Pending) {
  const receipt = await readClient(pending.config).waitForTransactionReceipt({
    hash: pending.hash as TransactionHash,
    status: TransactionStatus.FINALIZED,
    interval: 4000,
    retries: 15,
  });
  assertSuccess(receipt);
  return receipt;
}
export async function send(
  config: ChainConfig,
  session: WalletSession,
  action: string,
  args: CalldataEncodable[],
  value = 0n,
) {
  const { client } = await walletClient(
    config,
    session.provider,
    session.address,
  );
  return (await client.writeContract({
    address: requireContract(config),
    functionName: action,
    args,
    value,
    leaderOnly: false,
  })) as `0x${string}`;
}
export async function deploy(config: ChainConfig, session: WalletSession) {
  const { client } = await walletClient(
    config,
    session.provider,
    session.address,
  );
  const response = await fetch('/contracts/proofdesk.py');
  if (!response.ok) throw new Error('Contract source is unavailable.');
  return client.deployContract({
    code: new TextEncoder().encode(await response.text()),
    args: [],
    leaderOnly: false,
  });
}
