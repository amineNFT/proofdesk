import { validateBrief, validateClaims, type Job } from './proofdesk.ts';

export function filterWorkspace(
  jobs: Job[],
  wallet: string,
  scope: 'mine' | 'all',
  query: string,
): Job[] {
  const account = wallet.toLowerCase();
  const text = query.trim().toLowerCase();
  return jobs.filter(
    (job) =>
      job.origin !== 'sample' &&
      (scope === 'all' ||
        job.origin === 'draft' ||
        (account &&
          [job.owner, job.researcher].some(
            (address) => address.toLowerCase() === account,
          ))) &&
      job.title.toLowerCase().includes(text),
  );
}

export function restoreDrafts(value: unknown): Job[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    try {
      if (
        !raw ||
        raw.origin !== 'draft' ||
        typeof raw.id !== 'string' ||
        !Array.isArray(raw.requirements) ||
        !Array.isArray(raw.claims) ||
        typeof raw.researcher !== 'string' ||
        typeof raw.bounty_wei !== 'string' ||
        !/^\d{1,26}$/.test(raw.bounty_wei) ||
        !Number.isFinite(raw.created_at) ||
        !Number.isFinite(raw.deadline) ||
        raw.deadline <= raw.created_at
      )
        return [];
      validateBrief(
        raw.title,
        raw.requirements,
        raw.researcher,
        Math.ceil((raw.deadline - raw.created_at) / 86400),
      );
      const claims = raw.claims.length ? validateClaims(raw.claims) : [];
      return [
        {
          ...raw,
          claims,
          review: null,
          status: 'open',
          revision: 0,
          paid: false,
        } as Job,
      ];
    } catch {
      return [];
    }
  });
}
