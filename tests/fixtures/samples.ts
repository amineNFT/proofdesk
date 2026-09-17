import {
  decide,
  type Claim,
  type Job,
  type Review,
  type ClaimResult,
  type CriterionResult,
} from '../../lib/proofdesk.ts';
const sampleClaims: Claim[] = [
  {
    text: 'The PostgreSQL license permits use for any purpose without a license fee, subject to retaining its notices.',
    url: 'https://www.postgresql.org/about/licence/',
  },
  {
    text: 'SQLite requires a paid license for commercial applications.',
    url: 'https://www.sqlite.org/copyright.html',
  },
  {
    text: 'Redis persistence supports both RDB snapshots and an append-only file.',
    url: 'https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/',
  },
];
export function sampleJob(scenario: Job['scenario'] = 'flawed'): Job {
  const claims = sampleClaims.map((c) => ({ ...c }));
  if (scenario !== 'flawed')
    claims[1].text =
      'SQLite states that its deliverable library is in the public domain and does not require a license.';
  return {
    id: `sample-${scenario}`,
    title: 'Check the database shortlist',
    requirements: [
      'Describe the PostgreSQL license fee and notice conditions.',
      'State whether the SQLite library requires a license.',
      'Name the two Redis persistence mechanisms.',
    ],
    owner: 'Sample requester',
    researcher: 'Sample research agent',
    bounty_wei: '25000000000000000000',
    created_at: 1788955200,
    deadline: 1789641000,
    revision: scenario === 'corrected' ? 2 : 1,
    status: 'submitted',
    claims,
    review: null,
    paid: false,
    origin: 'sample',
    scenario,
  };
}
export function sampleReview(job: Job): Review {
  if (job.origin !== 'sample' || !job.scenario)
    throw new Error('Custom reports require a GenLayer review.');
  const canonical = sampleJob(job.scenario);
  if (JSON.stringify(job.claims) !== JSON.stringify(canonical.claims))
    throw new Error(
      'This sample was changed. Save it as a draft and request a network review.',
    );
  const claims: ClaimResult[] = [
    {
      verdict: 'supported',
      quote: 'for any purpose, without fee',
      reason: 'The license grants use without a fee, with notice conditions.',
    },
    {
      verdict: job.scenario === 'flawed' ? 'contradicted' : 'supported',
      quote: 'SQLite is in the public domain and does not require a license.',
      reason:
        job.scenario === 'flawed'
          ? 'The claim reverses the licensing statement on the cited page.'
          : 'The claim matches the stated status of the deliverable SQLite library.',
    },
    {
      verdict: job.scenario === 'unavailable' ? 'insufficient' : 'supported',
      quote:
        job.scenario === 'unavailable'
          ? ''
          : 'You can also combine both AOF and RDB in the same instance.',
      reason:
        job.scenario === 'unavailable'
          ? 'This scenario simulates an unavailable Redis source. No conclusion can be drawn from it.'
          : 'The documentation names RDB and AOF as persistence options.',
    },
  ];
  const criteria: CriterionResult[] = job.requirements.map(() => ({
    verdict: 'met',
    reason: 'The submitted claims address this criterion.',
  }));
  return { claims, criteria, decision: decide(claims, criteria) };
}
