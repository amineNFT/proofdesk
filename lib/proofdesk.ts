export type Claim = { text: string; url: string };
export type ClaimResult = {
  verdict: 'supported' | 'contradicted' | 'insufficient';
  quote: string;
  reason: string;
};
export type CriterionResult = {
  verdict: 'met' | 'unmet' | 'insufficient';
  reason: string;
};
export type Review = {
  claims: ClaimResult[];
  criteria: CriterionResult[];
  decision: 'approved' | 'needs_revision' | 'inconclusive';
};
export type JobStatus =
  | 'open'
  | 'submitted'
  | 'approved'
  | 'needs_revision'
  | 'inconclusive'
  | 'paid'
  | 'refunded';
export type Job = {
  id: string;
  title: string;
  requirements: string[];
  owner: string;
  researcher: string;
  bounty_wei: string;
  created_at: number;
  deadline: number;
  revision: number;
  status: JobStatus;
  claims: Claim[];
  review: Review | null;
  paid: boolean;
  origin: 'sample' | 'draft' | 'chain';
  scenario?: 'flawed' | 'corrected' | 'unavailable';
};
export const HOSTS = [
  'www.postgresql.org',
  'postgresql.org',
  'www.sqlite.org',
  'sqlite.org',
  'redis.io',
  'docs.python.org',
  'docs.genlayer.com',
  'developer.mozilla.org',
  'www.typescriptlang.org',
  'nodejs.org',
  'react.dev',
  'nextjs.org',
  'docs.docker.com',
  'kubernetes.io',
  'docs.github.com',
  'duckdb.org',
  'fastapi.tiangolo.com',
  'docs.pydantic.dev',
  'www.rust-lang.org',
];
export const LABELS: Record<string, string> = {
  open: 'Awaiting report',
  submitted: 'Ready for review',
  approved: 'Approved',
  needs_revision: 'Needs revision',
  inconclusive: 'Evidence missing',
  paid: 'Payment claimed',
  refunded: 'Refund claimed',
  supported: 'Supported',
  contradicted: 'Contradicted',
  insufficient: 'Insufficient evidence',
  met: 'Met',
  unmet: 'Not met',
};
export function validAddress(value: string) {
  return /^0x[0-9a-fA-F]{40}$/.test(value) && !/^0x0{40}$/.test(value);
}
export function validateClaim(claim: Claim): string | null {
  if (
    typeof claim?.text !== 'string' ||
    claim.text.trim().length < 10 ||
    claim.text.trim().length > 700
  )
    return 'Each claim needs 10 to 700 characters.';
  if (typeof claim?.url !== 'string' || claim.url.length > 500)
    return 'Add a source URL of at most 500 characters.';
  const match = /^https:\/\/([a-z0-9.-]+)(\/[^\s?#\\]*)?$/.exec(claim.url);
  if (!match || !HOSTS.includes(match[1]))
    return 'Use an approved HTTPS documentation URL without a query or fragment.';
  return null;
}
export function validateClaims(claims: Claim[]) {
  if (!Array.isArray(claims) || claims.length < 1 || claims.length > 8)
    throw new Error('Include 1 to 8 claims.');
  for (const c of claims) {
    const error = validateClaim(c);
    if (error) throw new Error(error);
  }
  if (
    new Set(claims.map((c) => c.text.trim().toLowerCase())).size !==
    claims.length
  )
    throw new Error('Remove duplicate claims.');
  return claims.map((c) => ({ text: c.text.trim(), url: c.url.trim() }));
}
export function validateBrief(
  title: string,
  requirements: string[],
  researcher: string,
  days: number,
) {
  if (title.trim().length < 8 || title.trim().length > 160)
    throw new Error('Use a title of 8 to 160 characters.');
  if (
    requirements.length < 1 ||
    requirements.length > 6 ||
    requirements.some((r) => r.trim().length < 8 || r.trim().length > 350)
  )
    throw new Error('Add 1 to 6 criteria, each 8 to 350 characters.');
  if (researcher && !validAddress(researcher))
    throw new Error('Enter a valid researcher wallet address.');
  if (!Number.isInteger(days) || days < 1 || days > 30)
    throw new Error('Choose a deadline between 1 and 30 days.');
}
export function parseAmount(amount: string): bigint {
  if (!/^\d{1,8}(\.\d{1,18})?$/.test(amount))
    throw new Error(
      'Enter a nonnegative amount with at most 18 decimal places.',
    );
  const [whole, fraction = ''] = amount.split('.');
  return BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, '0'));
}
export function formatAmount(wei: string) {
  const n = BigInt(wei);
  const f = (n % 10n ** 18n).toString().padStart(18, '0').replace(/0+$/, '');
  return `${n / 10n ** 18n}${f ? '.' + f : ''}`;
}
export function decide(
  claims: ClaimResult[],
  criteria: CriterionResult[],
): Review['decision'] {
  if (!claims.length || !criteria.length) return 'inconclusive';
  if (
    claims.some((c) => c.verdict === 'contradicted') ||
    criteria.some((c) => c.verdict === 'unmet')
  )
    return 'needs_revision';
  if (
    claims.every((c) => c.verdict === 'supported') &&
    criteria.every((c) => c.verdict === 'met')
  )
    return 'approved';
  return 'inconclusive';
}
export function newDraft(
  title: string,
  requirements: string[],
  researcher: string,
  days: number,
  bounty: string,
): Job {
  validateBrief(title, requirements, researcher, days);
  const now = Math.floor(Date.now() / 1000);
  return {
    id: `pd-${crypto.randomUUID()}`,
    title: title.trim(),
    requirements: requirements.map((r) => r.trim()),
    owner: '',
    researcher,
    bounty_wei: parseAmount(bounty).toString(),
    created_at: now,
    deadline: now + days * 86400,
    revision: 0,
    status: 'open',
    claims: [],
    review: null,
    paid: false,
    origin: 'draft',
  };
}
export function receiptMarkdown(job: Job) {
  const lines = [
    `# ${job.title}`,
    '',
    `Brief: ${job.id}`,
    `Mode: ${job.origin === 'sample' ? 'Illustrative sample, not a network verdict' : job.origin === 'draft' ? 'Local draft' : 'GenLayer contract record'}`,
    `Status: ${LABELS[job.status]}`,
    `Revision: ${job.revision}`,
    '',
    '## Acceptance criteria',
    ...job.requirements.map((r, i) => `${i + 1}. ${r}`),
    '',
    '## Claims',
  ];
  job.claims.forEach((c, i) => {
    const r = job.review?.claims[i];
    lines.push(
      '',
      `### ${i + 1}. ${c.text}`,
      `Source: ${c.url}`,
      r ? `Verdict: ${LABELS[r.verdict]}` : 'Not reviewed',
      ...(r ? [r.quote ? `> ${r.quote}` : 'No source passage.', r.reason] : []),
    );
  });
  return lines.join('\n');
}
