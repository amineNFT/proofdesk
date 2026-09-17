'use client';
import { errorMessage } from '@/lib/errors';
import { filterWorkspace, restoreDrafts } from '@/lib/workspace';
import {
  discoverWallets,
  preferredWallet,
  type WalletOption,
  type WalletSession,
} from '@/lib/wallet';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Check,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Settings2,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  HOSTS,
  LABELS,
  formatAmount,
  newDraft,
  receiptMarkdown,
  validateBrief,
  validateClaims,
  validAddress,
  type Claim,
  type Job,
} from '@/lib/proofdesk';
import {
  deploy,
  listJobs,
  readJob,
  send,
  track,
  walletClient,
  networks,
  type ChainConfig,
  type Pending,
} from '@/lib/chain';
import deployment from '@/lib/deployment.json';
import { FinalizedFailure } from '@/lib/receipt';
import { feeUsage, type FeeUsage } from '@/lib/fees';
import { FeeReceipt, formatGen } from '@genlayer/transaction-kit-react';
import type { PolicyQuote } from '@genlayer/transaction-kit';
import { registerDeskTools } from '@/lib/webmcp';

const CONFIG_KEY = 'proofdesk:network:v1',
  DRAFT_KEY = 'proofdesk:drafts:v1',
  PENDING_KEY = 'proofdesk:pending:v1',
  REPORT_KEY = 'proofdesk:reports:v1';
const reportKey = (c: ChainConfig, id: string) =>
  `${c.network}:${c.contract.toLowerCase()}:${id}`;
const initialConfig: ChainConfig = {
  network: deployment.network as ChainConfig['network'],
  contract: deployment.contract,
};
const short = (value: string) =>
  validAddress(value)
    ? `${value.slice(0, 6)}…${value.slice(-4)}`
    : value || 'Not assigned';

/** Deposit, consumed and refunded totals stay separate in the pending panel. */
function feeUsageLine(usage: FeeUsage): string {
  const part = (label: string, value: string | undefined) =>
    value === undefined ? '' : `${label} ${formatGen(BigInt(value))} GEN`;
  return [
    part('Deposit', usage.deposit),
    part('Consumed', usage.consumed),
    part('Refunded', usage.refunded),
  ]
    .filter(Boolean)
    .join(' · ');
}
function Badge({ status }: { status: string }) {
  return (
    <span className={`status ${status}`}>
      {status === 'supported' && <Check size={11} />} {LABELS[status] ?? status}
    </span>
  );
}
function ErrorMessage({ message }: { message: string }) {
  return message ? (
    <p className="form-error" role="alert">
      {message}
    </p>
  ) : null;
}

export default function ProofDesk() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selected, setSelected] = useState('');
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [query, setQuery] = useState('');
  const [view, setView] = useState('claims');
  const [config, setConfig] = useState<ChainConfig>(initialConfig);
  const [wallet, setWallet] = useState('');
  const [walletOptions, setWalletOptions] = useState<WalletOption[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<WalletOption | null>(
    null,
  );
  const [modal, setModal] = useState<
    'new' | 'edit' | 'network' | 'report' | null
  >(null);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [feeQuote, setFeeQuote] = useState<PolicyQuote | null>(null);
  const [feeUsed, setFeeUsed] = useState<FeeUsage | null>(null);
  const [more, setMore] = useState(false);
  const [history, setHistory] = useState<Job[]>([]);
  const [reports, setReports] = useState<Record<string, Claim[]>>({});
  const lock = useRef(false);
  const autoConnect = useRef(false);
  const visibleJobs = filterWorkspace(jobs, wallet, scope, query);
  const job = visibleJobs.find((j) => j.id === selected) ?? visibleJobs[0];
  const stateRef = useRef({ jobs, selected });
  useEffect(() => {
    stateRef.current = { jobs, selected };
  }, [jobs, selected]);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now() / 1000);
    queueMicrotask(tick);
    const timer = setInterval(tick, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const staged = localStorage.getItem(REPORT_KEY);
        if (staged) {
          const parsed = JSON.parse(staged);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
            setReports(parsed);
        }
        const saved = localStorage.getItem(DRAFT_KEY);
        if (saved) {
          setJobs(restoreDrafts(JSON.parse(saved)));
        }
        const network = localStorage.getItem(CONFIG_KEY);
        if (network) {
          const c = JSON.parse(network);
          if (
            ['studioDevnet', 'testnetBradbury'].includes(c.network) &&
            (!c.contract || validAddress(c.contract))
          )
            setConfig(c);
        }
        const current = localStorage.getItem(PENDING_KEY);
        if (current) {
          const p = JSON.parse(current);
          if (
            /^0x[a-fA-F0-9]{64}$/.test(p.hash) &&
            ['studioDevnet', 'testnetBradbury'].includes(p.config?.network)
          )
            setPending(p);
        }
      } catch {
        setError(
          'Saved workspace data could not be read. You can create a new brief or load your network records.',
        );
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify(jobs.filter((j) => j.origin === 'draft')),
      );
    } catch {
      queueMicrotask(() =>
        setError(
          'This browser could not save drafts. Export your brief before closing.',
        ),
      );
    }
  }, [jobs, ready]);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(REPORT_KEY, JSON.stringify(reports));
    } catch {
      queueMicrotask(() =>
        setError(
          'The staged report could not be saved. Export it before closing.',
        ),
      );
    }
  }, [reports, ready]);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    } catch {
      /* Preference only. */
    }
  }, [config, ready]);
  useEffect(() => {
    if (!ready) return;
    try {
      if (pending) localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
      else localStorage.removeItem(PENDING_KEY);
    } catch {
      queueMicrotask(() =>
        setError(
          'Could not save the transaction ID. Copy it before closing this page.',
        ),
      );
    }
  }, [pending, ready]);
  useEffect(() => {
    let active = true;
    const cleanup = discoverWallets(window, (options) => {
      queueMicrotask(() => {
        if (active) setWalletOptions(options);
      });
    });
    return () => {
      active = false;
      cleanup();
    };
  }, []);
  /**
   * Connect to a detected wallet without a picker. The canonical EIP-6963
   * announcement wins over a legacy injected provider; the first detected
   * wallet is the fallback.
   */
  async function connectWallet(option?: WalletOption) {
    const target = option ?? preferredWallet(walletOptions);
    if (!target) {
      setError(
        'No browser wallet was detected. Install Rabby or MetaMask, enable it for this site, and reload.',
      );
      return;
    }
    await run(`Connecting ${target.name}`, async () => {
      setWallet('');
      const connected = await walletClient(config, target.provider);
      setSelectedWallet(target);
      setWallet(connected.address);
      await refresh();
      setNotice(`Connected ${target.name}: ${short(connected.address)}.`);
    });
  }
  function disconnectWallet() {
    setWallet('');
    setSelectedWallet(null);
    setNotice('Wallet disconnected from ProofDesk.');
  }
  // Connect as soon as a wallet is detected. A declined or unavailable request
  // must not block the workspace, so the reason waits behind the Connect wallet
  // button instead of filling the page with an error on load.
  useEffect(() => {
    if (!ready || wallet || autoConnect.current || !walletOptions.length) return;
    const target = preferredWallet(walletOptions);
    if (!target) return;
    autoConnect.current = true;
    // Deferred so the connection is not a synchronous state update inside the
    // effect body; the wallet extension is the external system here.
    queueMicrotask(() => {
      void (async () => {
        setBusy('Connecting wallet');
        try {
          const connected = await walletClient(config, target.provider);
          setSelectedWallet(target);
          setWallet(connected.address);
          setNotice(`Connected ${target.name}: ${short(connected.address)}.`);
        } catch {
          setNotice(
            'Wallet connection was not approved. Use Connect wallet when you are ready.',
          );
        } finally {
          setBusy('');
        }
      })();
    });
  }, [ready, wallet, walletOptions, config]);
  useEffect(() => {
    const provider = selectedWallet?.provider;
    const reset = () => setWallet('');
    provider?.on?.('accountsChanged', reset);
    provider?.on?.('chainChanged', reset);
    provider?.on?.('disconnect', reset);
    return () => {
      provider?.removeListener?.('accountsChanged', reset);
      provider?.removeListener?.('chainChanged', reset);
      provider?.removeListener?.('disconnect', reset);
    };
  }, [selectedWallet]);
  useEffect(
    () =>
      registerDeskTools({
        read: () => stateRef.current.jobs,
        create: (input) => {
          const draft = newDraft(
            input.title,
            input.requirements,
            input.researcher ?? '',
            input.days ?? 7,
            input.bounty ?? '0',
          );
          setJobs((prev) => [...prev, draft]);
          setSelected(draft.id);
          setNotice('Draft saved on this device.');
          return draft;
        },
      }),
    [],
  );

  function replace(next: Job) {
    setJobs((prev) =>
      prev.some((j) => j.id === next.id)
        ? prev.map((j) => (j.id === next.id ? next : j))
        : [...prev, next],
    );
  }
  function walletSession(): WalletSession {
    if (!selectedWallet || !wallet)
      throw new Error('Connect a wallet before continuing.');
    return { provider: selectedWallet.provider, address: wallet };
  }
  async function run(label: string, action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(label);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      lock.current = false;
      setBusy('');
    }
  }
  function choose(id: string) {
    setSelected(id);
    setView('claims');
    setHistory([]);
    setError('');
    setNotice('');
  }
  async function refresh(append = false) {
    const offset = append ? jobs.filter((j) => j.origin === 'chain').length : 0;
    const result = await listJobs(config, offset);
    setJobs((prev) => [
      ...prev.filter((j) => j.origin !== 'chain' || append),
      ...result.jobs.filter(
        (j) =>
          !append ||
          !prev.some((old) => old.origin === 'chain' && old.id === j.id),
      ),
    ]);
    setMore(result.hasMore);
    setNotice(
      result.jobs.length
        ? `${result.jobs.length} network briefs loaded.`
        : 'No briefs have been posted to this contract yet.',
    );
  }
  async function complete(p: Pending) {
    let receipt;
    try {
      receipt = await track(p);
    } catch (e) {
      if (e instanceof FinalizedFailure) setPending(null);
      throw e;
    }
    // Deposit, consumed and refunded amounts are reported separately once the
    // transaction finalizes; report nothing rather than guessing when absent.
    setFeeUsed(feeUsage(receipt) ?? null);
    if (p.action === 'deploy') {
      const address =
        receipt.data?.contract_address ??
        receipt.to_address ??
        receipt.recipient;
      if (typeof address !== 'string' || !validAddress(address))
        throw new Error(
          'Deployment finalized, but the contract address could not be read. Keep this transaction ID.',
        );
      const next = { ...p.config, contract: address };
      setConfig(next);
      setNotice(`Contract deployed: ${address}`);
    } else if (p.jobId) {
      if (p.action === 'create_brief' && p.reportClaims?.length)
        setReports((prev) => ({
          ...prev,
          [reportKey(p.config, p.jobId!)]: p.reportClaims!,
        }));
      if (p.action === 'submit_report')
        setReports((prev) =>
          Object.fromEntries(
            Object.entries(prev).filter(
              ([key]) => key !== reportKey(p.config, p.jobId!),
            ),
          ),
        );
      const current = await readJob(p.config, p.jobId);
      replace(current);
      setSelected(current.id);
      setNotice(
        'The transaction finalized. The record below comes from the contract.',
      );
    }
    setPending(null);
  }
  async function transact(
    action: string,
    args: (string | number)[],
    id: string,
    value = 0n,
  ) {
    if (pending)
      throw new Error(
        'Track the pending transaction before submitting another.',
      );
    const hash = await send(
      config,
      walletSession(),
      action,
      args,
      value,
      setFeeQuote,
    );
    const p: Pending = {
      hash,
      action,
      jobId: id,
      config: { ...config },
      ...(action === 'create_brief' ? { reportClaims: job?.claims } : {}),
    };
    // Persist synchronously before polling: a reload must not lose a submitted transaction.
    setPending(p);
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify(p));
    } catch {
      /* Visible hash remains available. */
    }
    await complete(p);
  }
  async function publish() {
    if (!job) return;
    if (!validAddress(job.researcher))
      throw new Error('Edit the brief and assign a researcher wallet first.');
    const days = Math.max(
      1,
      Math.min(30, Math.ceil((job.deadline - job.created_at) / 86400)),
    );
    await transact(
      'create_brief',
      [
        job.id,
        job.title,
        JSON.stringify(job.requirements),
        job.researcher,
        days,
      ],
      job.id,
      BigInt(job.bounty_wei),
    );
  }
  function exportFile() {
    if (!job) return;
    const blob = new Blob([receiptMarkdown(job)], {
      type: 'text/markdown;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `proofdesk-${job.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }
  const isDraft = job?.origin === 'draft';
  const supported =
    job?.review?.claims.filter((c) => c.verdict === 'supported').length ?? 0;
  const canSubmit = ['open', 'needs_revision', 'inconclusive'].includes(
    job?.status ?? '',
  );
  const disabled = Boolean(busy) || Boolean(pending);
  const walletResearcher =
    Boolean(wallet) && wallet.toLowerCase() === job?.researcher.toLowerCase();
  const walletOwner =
    Boolean(wallet) && wallet.toLowerCase() === job?.owner.toLowerCase();

  return (
    <>
      <a className="skip-link" href="#case-file">
        Skip to research file
      </a>
      <header className="masthead">
        <Link className="wordmark" href="/">
          proofdesk<span>.</span>
        </Link>
        <nav className="mast-nav">
          <span className="beta-label">Community beta</span>
          <Link href="/method">
            How reviews work <ArrowUpRight size={12} />
          </Link>
        </nav>
        <Button
          variant="outline"
          disabled={Boolean(busy)}
          onClick={() => {
            setError('');
            if (wallet) disconnectWallet();
            else void connectWallet();
          }}
        >
          <Wallet />
          {wallet
            ? `${selectedWallet?.name ?? 'Wallet'} · ${short(wallet)}`
            : 'Connect wallet'}
        </Button>
      </header>
      <main className="desk">
        <div className="page-heading">
          <div>
            <h1>Research workspace</h1>
            <p className="lede">
              Set a brief, submit your sources, and get an independent review.
            </p>
          </div>
          <Button className="primary-action" onClick={() => setModal('new')}>
            <Plus /> New brief
          </Button>
        </div>
        <div className="workspace-bar">
          <div>
            {config.network === 'studioDevnet'
              ? 'GenLayer Studio Next'
              : 'Bradbury testnet'}
            <span className="bar-divider">·</span>
            <span>
              {config.contract
                ? 'Test network · Test tokens only'
                : 'Contract not configured'}
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setModal('network')}>
            <Settings2 /> Network settings
          </Button>
        </div>
        {error && (
          <div className="message error" role="alert">
            <span>{error}</span>
            <button aria-label="Dismiss error" onClick={() => setError('')}>
              <X size={16} />
            </button>
          </div>
        )}
        {notice && (
          <output className="message">
            <span>{notice}</span>
            <button aria-label="Dismiss message" onClick={() => setNotice('')}>
              <X size={16} />
            </button>
          </output>
        )}
        {busy && (
          <output className="message">
            <Loader2 className="spin" size={15} />
            {busy}…
          </output>
        )}
        {pending && (
          <div className="pending-box">
            <div>
              <strong>Transaction submitted</strong>
              <p>
                {pending.action.replaceAll('_', ' ')} · {pending.config.network}
              </p>
              <code>{pending.hash}</code>
              <p>
                Keep this ID. A timeout does not mean the transaction failed.
              </p>
              {feeQuote && (
                <FeeReceipt quote={feeQuote} busy={Boolean(busy)} />
              )}
              {feeUsed && <p>{feeUsageLine(feeUsed)}</p>}
            </div>
            <Button
              variant="outline"
              disabled={Boolean(busy)}
              onClick={() =>
                run('Checking transaction', () => complete(pending))
              }
            >
              <RefreshCw /> Check status
            </Button>
          </div>
        )}
        <div className="workbench">
          <aside className="brief-list">
            <Tabs
              value={scope}
              onValueChange={(value) => {
                setScope(value as 'mine' | 'all');
                setHistory([]);
              }}
            >
              <TabsList className="scope-tabs">
                <TabsTrigger value="mine">My briefs</TabsTrigger>
                <TabsTrigger
                  value="all"
                  onClick={() => {
                    if (!busy && !jobs.some((j) => j.origin === 'chain'))
                      void run('Loading community briefs', () => refresh());
                  }}
                >
                  Community
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <label className="sr-only" htmlFor="brief-search">
              Search briefs
            </label>
            <Input
              id="brief-search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setHistory([]);
              }}
              placeholder="Search briefs"
              className="brief-search"
            />
            <div className="section-label">
              BRIEFS <span>{visibleJobs.length}</span>
            </div>
            <div className="brief-items">
              {visibleJobs.map((j, i) => (
                <button
                  key={j.id}
                  className={`brief-item ${job?.id === j.id ? 'selected' : ''}`}
                  onClick={() => choose(j.id)}
                  aria-current={job?.id === j.id ? 'true' : undefined}
                >
                  <span className="mono">
                    {String(i + 1).padStart(2, '0')} /{' '}
                    {j.origin === 'draft' ? 'LOCAL DRAFT' : 'ON CHAIN'}
                  </span>
                  <strong>{j.title}</strong>
                  {j.origin === 'draft' ? (
                    <span className="draft-label">Draft</span>
                  ) : (
                    <Badge status={j.status} />
                  )}
                </button>
              ))}
            </div>
            <Button
              variant="ghost"
              className="load-briefs"
              disabled={Boolean(busy) || !config.contract}
              onClick={() => {
                if (scope === 'mine' && !wallet) void connectWallet();
                else void run('Loading network briefs', () => refresh(more));
              }}
            >
              <RefreshCw />
              {scope === 'mine' && !wallet
                ? 'Connect to load briefs'
                : more
                  ? 'Load more'
                  : 'Refresh briefs'}
            </Button>
            <div className="desk-note">
              <p>
                Drafts stay in this browser. Posted briefs and reports are
                public.
              </p>
              <Link href="/method">
                Review policy <ArrowUpRight size={12} />
              </Link>
            </div>
          </aside>
          <article className="case-file" id="case-file">
            {!job ? (
              <div className="workspace-empty">
                <FileText size={28} />
                <h2>
                  {!ready
                    ? 'Opening your workspace…'
                    : query
                      ? 'No matching briefs'
                      : 'Start with a research brief'}
                </h2>
                <p>
                  {query
                    ? 'Try a different title or clear the search.'
                    : scope === 'mine' && !wallet
                      ? 'Create a draft now, or connect your wallet to find work you requested or were assigned.'
                      : 'Write the question you need answered and decide what a complete report must include.'}
                </p>
                {!query && (
                  <ol className="workflow-intro">
                    <li>
                      <strong>Define the work</strong>
                      <span>Set the questions, researcher, and deadline.</span>
                    </li>
                    <li>
                      <strong>Submit the evidence</strong>
                      <span>
                        Add factual claims with official source links.
                      </span>
                    </li>
                    <li>
                      <strong>Request a review</strong>
                      <span>
                        GenLayer checks the sources and the agreed criteria.
                      </span>
                    </li>
                  </ol>
                )}
                <div className="empty-actions">
                  {query ? (
                    <Button variant="outline" onClick={() => setQuery('')}>
                      Clear search
                    </Button>
                  ) : (
                    <Button onClick={() => setModal('new')}>
                      <Plus /> Create a brief
                    </Button>
                  )}
                  {!wallet && !query && (
                    <Button
                      variant="outline"
                      onClick={() => void connectWallet()}
                    >
                      Connect wallet
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="case-topline">
                  <span className="eyebrow">
                    {isDraft ? 'LOCAL DRAFT' : 'CONTRACT RECORD'}
                  </span>
                  {isDraft ? (
                    <span className="draft-label">Draft</span>
                  ) : (
                    <Badge status={job.status} />
                  )}
                </div>
                <h2>{job.title}</h2>
                <p className="case-description">{job.requirements[0]}</p>
                <div className="file-meta">
                  <span>{job.claims.length} claims</span>
                  <span>Official sources only</span>
                  <span>
                    {isDraft
                      ? 'Saved on this device'
                      : `Revision ${job.revision}`}
                  </span>
                </div>
                <div className="file-actions">
                  <div>
                    {isDraft ? (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => setModal('edit')}
                        >
                          Edit brief
                        </Button>
                        <Button
                          className="primary-action"
                          disabled={
                            disabled || !wallet || !validAddress(job.researcher)
                          }
                          onClick={() => run('Posting brief', publish)}
                        >
                          Post brief to GenLayer <ArrowUpRight />
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setModal('report')}
                        >
                          {job.claims.length ? 'Edit report' : 'Write report'}
                        </Button>
                      </>
                    ) : job.status === 'submitted' ? (
                      <Button
                        className="primary-action"
                        disabled={
                          disabled || (!walletOwner && !walletResearcher)
                        }
                        onClick={() =>
                          run('Reviewing sources on GenLayer', () =>
                            transact('review_report', [job.id], job.id),
                          )
                        }
                      >
                        Request review <ArrowRight />
                      </Button>
                    ) : canSubmit ? (
                      <Button
                        className="primary-action"
                        disabled={disabled || !walletResearcher}
                        onClick={() => setModal('report')}
                      >
                        {job.revision ? 'Submit a revision' : 'Submit report'}{' '}
                        <ArrowRight />
                      </Button>
                    ) : job.status === 'approved' &&
                      !/^0+$/.test(job.bounty_wei) ? (
                      <Button
                        className="primary-action"
                        disabled={disabled || !walletResearcher}
                        onClick={() =>
                          run('Claiming test-token payment', () =>
                            transact('claim_payout', [job.id], job.id),
                          )
                        }
                      >
                        Claim {formatAmount(job.bounty_wei)} test GEN{' '}
                        <ArrowRight />
                      </Button>
                    ) : null}
                  </div>
                  <Button variant="ghost" onClick={exportFile}>
                    Export report <ArrowDownToLine />
                  </Button>
                </div>
                {!wallet && (
                  <p className="help-text">
                    <button
                      className="text-button"
                      onClick={() => void connectWallet()}
                    >
                      Connect your wallet
                    </button>{' '}
                    to post a brief or submit a report.
                  </p>
                )}
                {isDraft && (
                  <p className="help-text">
                    Posting fixes the brief and researcher on chain. Submit the
                    saved report after the brief is posted. Amounts use test
                    tokens.
                  </p>
                )}
                <Tabs
                  value={view}
                  onValueChange={(value) => setView(String(value))}
                >
                  <TabsList variant="line" className="file-tabs">
                    <TabsTrigger value="claims">
                      Claims & evidence{' '}
                      <span className="tab-count">{job.claims.length}</span>
                    </TabsTrigger>
                    <TabsTrigger value="brief">The brief</TabsTrigger>
                    <TabsTrigger value="receipt">Review record</TabsTrigger>
                  </TabsList>
                  <TabsContent value="claims">
                    <div className="claims-heading">
                      <h3>
                        {job.review ? 'Evidence review' : 'Submitted claims'}
                      </h3>
                      <span className="mono">
                        {job.review
                          ? `${supported} / ${job.claims.length} SUPPORTED`
                          : 'NOT YET REVIEWED'}
                      </span>
                    </div>
                    {job.claims.length === 0 ? (
                      <div className="empty-report">
                        <FileText size={30} />
                        <h3>No report yet</h3>
                        <p>
                          Add a claim and its official source. Reports can
                          contain up to eight claims.
                        </p>
                      </div>
                    ) : (
                      job.claims.map((claim, i) => {
                        const result = job.review?.claims[i];
                        return (
                          <details
                            className="claim-row"
                            key={`${job.id}-${job.revision}-${i}`}
                            open={
                              result?.verdict === 'contradicted' || undefined
                            }
                          >
                            <summary>
                              <span className="claim-index">
                                {String(i + 1).padStart(2, '0')}
                              </span>
                              <div>
                                {result ? (
                                  <Badge status={result.verdict} />
                                ) : (
                                  <span className="unreviewed">
                                    Awaiting review
                                  </span>
                                )}
                                <h4>{claim.text}</h4>
                                <span className="source-domain">
                                  {new URL(claim.url).hostname}
                                </span>
                              </div>
                              <Plus size={16} className="expand-icon" />
                            </summary>
                            <div className="evidence-detail">
                              <div className="evidence-label">
                                CITED SOURCE{' '}
                                <a
                                  href={claim.url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Open source <ArrowUpRight size={12} />
                                </a>
                              </div>
                              <p className="source-url">{claim.url}</p>
                              {result ? (
                                <>
                                  {result.quote ? (
                                    <blockquote>{result.quote}</blockquote>
                                  ) : (
                                    <p className="missing-evidence">
                                      No usable source passage.
                                    </p>
                                  )}
                                  <p className="reason">{result.reason}</p>
                                </>
                              ) : (
                                <p className="reason">
                                  Run a review to check what this source
                                  supports.
                                </p>
                              )}
                            </div>
                          </details>
                        );
                      })
                    )}
                    {job.review && (
                      <div className={`review-note ${job.status}`}>
                        <span className="eyebrow">GENLAYER REVIEW</span>
                        <p>
                          {job.review.decision === 'approved'
                            ? 'The sources support every claim, and the report addresses each acceptance criterion.'
                            : job.review.decision === 'needs_revision'
                              ? 'The report needs a correction before payment can be claimed. Read the flagged evidence and acceptance criteria.'
                              : 'The evidence is incomplete. Add a usable source or narrow the claim, then submit another revision.'}
                        </p>
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="brief">
                    <section className="brief-content">
                      <p className="eyebrow">ACCEPTANCE CRITERIA</p>
                      <ol>
                        {job.requirements.map((r, i) => (
                          <li key={i}>
                            <span>{r}</span>
                            {job.review && (
                              <Badge
                                status={
                                  job.review.criteria[i]?.verdict ??
                                  'insufficient'
                                }
                              />
                            )}
                          </li>
                        ))}
                      </ol>
                      <dl className="brief-details">
                        <div>
                          <dt>Requester</dt>
                          <dd>
                            {job.owner
                              ? short(job.owner)
                              : 'Assigned when posted'}
                          </dd>
                        </div>
                        <div>
                          <dt>Researcher</dt>
                          <dd>{short(job.researcher)}</dd>
                        </div>
                        <div>
                          <dt>Test-token budget</dt>
                          <dd>{formatAmount(job.bounty_wei)} test GEN</dd>
                        </div>
                        <div>
                          <dt>Deadline</dt>
                          <dd>
                            {new Date(job.deadline * 1000)
                              .toISOString()
                              .slice(0, 10)}{' '}
                            UTC
                          </dd>
                        </div>
                        <div>
                          <dt>Brief ID</dt>
                          <dd className="break-all">{job.id}</dd>
                        </div>
                      </dl>
                      {isDraft && (
                        <Button
                          variant="ghost"
                          onClick={() => {
                            if (
                              window.confirm(
                                'Delete this local draft and its saved report? Posted records will remain on GenLayer.',
                              )
                            ) {
                              setJobs((previous) =>
                                previous.filter((entry) => entry.id !== job.id),
                              );
                              setSelected('');
                              setHistory([]);
                              setNotice('Local draft deleted.');
                            }
                          }}
                        >
                          <Trash2 /> Delete local draft
                        </Button>
                      )}
                      <details className="sources-policy">
                        <summary>Approved documentation sources</summary>
                        <p>
                          Sources must use HTTPS and one of these exact hosts.
                          Query strings and fragments are not accepted.
                        </p>
                        <div>
                          {HOSTS.map((h) => (
                            <code key={h}>{h}</code>
                          ))}
                        </div>
                      </details>
                      {job.origin === 'chain' &&
                        walletOwner &&
                        !['approved', 'paid', 'refunded'].includes(
                          job.status,
                        ) && (
                          <div className="refund-area">
                            <p>
                              Unapproved work can be refunded after its
                              deadline. A submitted report receives seven
                              additional days for review.
                            </p>
                            <Button
                              variant="outline"
                              disabled={
                                disabled ||
                                now <
                                  job.deadline +
                                    (job.status === 'submitted' ? 604800 : 0)
                              }
                              onClick={() =>
                                run('Requesting expired-brief refund', () =>
                                  transact('refund_expired', [job.id], job.id),
                                )
                              }
                            >
                              Claim expired-brief refund
                            </Button>
                          </div>
                        )}
                    </section>
                  </TabsContent>
                  <TabsContent value="receipt">
                    <section className="receipt-content">
                      <p className="eyebrow">REVIEW RECORD</p>
                      <h3>
                        {job.review ? LABELS[job.status] : 'No review yet'}
                      </h3>
                      <p>
                        {isDraft
                          ? 'This brief is stored on this device. Post it to GenLayer to create a shared record.'
                          : 'This view reads finalized contract state. The transaction must also execute successfully before the app marks an action complete.'}
                      </p>
                      {job.review && (
                        <div className="criteria-results">
                          {job.review.criteria.map((c, i) => (
                            <div key={i}>
                              <Badge status={c.verdict} />
                              <strong>{job.requirements[i]}</strong>
                              <p>{c.reason}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      <Button variant="outline" onClick={exportFile}>
                        <ArrowDownToLine /> Export Markdown receipt
                      </Button>
                      {job.origin === 'chain' && job.revision > 0 && (
                        <Button
                          variant="ghost"
                          disabled={Boolean(busy)}
                          onClick={() =>
                            run('Loading reviewed revisions', async () => {
                              const { readClient, requireContract } =
                                await import('@/lib/chain');
                              const { TransactionHashVariant } =
                                await import('genlayer-js/types');
                              const client = readClient(config);
                              const results = [];
                              for (let i = 1; i <= job.revision; i++) {
                                if (i === job.revision && !job.review) continue;
                                const raw = await client.readContract({
                                  address: requireContract(config),
                                  functionName: 'get_revision',
                                  args: [job.id, i],
                                  transactionHashVariant:
                                    TransactionHashVariant.LATEST_FINAL,
                                });
                                if (typeof raw !== 'string')
                                  throw new Error('Invalid revision response.');
                                results.push(JSON.parse(raw));
                              }
                              setHistory(results);
                            })
                          }
                        >
                          Load revision history
                        </Button>
                      )}
                      {history.map((h) => (
                        <details key={h.revision} className="history-row">
                          <summary>
                            Revision {h.revision} · {LABELS[h.status]}
                          </summary>
                          {h.claims.map((c, i) => (
                            <p key={i}>
                              {c.text}
                              <br />
                              <small>
                                {
                                  LABELS[
                                    h.review?.claims[i]?.verdict ??
                                      'insufficient'
                                  ]
                                }
                              </small>
                            </p>
                          ))}
                        </details>
                      ))}
                    </section>
                  </TabsContent>
                </Tabs>
              </>
            )}
          </article>
        </div>
        <footer className="desk-footer">
          <span>ProofDesk</span>
          <span>
            <Link href="/method">Method & limits</Link> /{' '}
            <a href="/contracts/proofdesk.py" download>
              Contract source
            </a>
          </span>
        </footer>
      </main>
      <Dialog
        open={modal === 'new' || modal === 'edit'}
        onOpenChange={(open) => {
          if (!open) setModal(null);
        }}
      >
        <DialogContent className="desk-dialog">
          <DialogHeader>
            <DialogTitle>
              {modal === 'edit' ? 'Edit brief' : 'New research brief'}
            </DialogTitle>
            <DialogDescription>
              Write the questions that a reviewer must be able to answer from
              the report.
            </DialogDescription>
          </DialogHeader>
          <BriefForm
            key={`${modal}-${job?.id ?? 'new'}`}
            existing={modal === 'edit' ? job : undefined}
            wallet={wallet}
            onSave={(draft) => {
              replace(draft);
              setQuery('');
              choose(draft.id);
              setModal(null);
              setNotice('Brief saved on this device.');
            }}
          />
        </DialogContent>
      </Dialog>
      {job && (
        <Dialog
          open={modal === 'report'}
          onOpenChange={(open) => {
            if (!open) setModal(null);
          }}
        >
          <DialogContent className="desk-dialog wide">
            <DialogHeader>
              <DialogTitle>
                {job.revision ? 'Revise the report' : 'Write the report'}
              </DialogTitle>
              <DialogDescription>
                One factual claim per entry. Cite the official page that
                supports it.
              </DialogDescription>
            </DialogHeader>
            <ErrorMessage message={error} />
            <ReportForm
              key={`${job.id}-${modal}`}
              claims={
                job.origin === 'chain'
                  ? (reports[reportKey(config, job.id)] ?? job.claims)
                  : job.claims
              }
              busy={Boolean(busy)}
              local={isDraft}
              onSave={async (claims) => {
                if (isDraft) {
                  replace({ ...job, claims });
                  setModal(null);
                  setNotice('Report saved with this local draft.');
                } else {
                  await run('Submitting report', async () => {
                    await transact(
                      'submit_report',
                      [job.id, JSON.stringify(claims)],
                      job.id,
                    );
                    setModal(null);
                  });
                }
              }}
            />
          </DialogContent>
        </Dialog>
      )}
      <Dialog
        open={modal === 'network'}
        onOpenChange={(open) => {
          if (!open) setModal(null);
        }}
      >
        <DialogContent className="desk-dialog">
          <DialogHeader>
            <DialogTitle>GenLayer connection</DialogTitle>
            <DialogDescription>
              Choose the network and ProofDesk contract. Wallet signing stays in
              your wallet.
            </DialogDescription>
          </DialogHeader>
          <ErrorMessage message={error} />
          <NetworkForm
            config={config}
            disabled={disabled}
            onSave={(next) => {
              setConfig(next);
              setWallet('');
              setJobs((prev) => prev.filter((j) => j.origin !== 'chain'));
              setSelected('');
              setFeeQuote(null);
              setFeeUsed(null);
              setModal(null);
              setNotice(
                'Network settings saved. Load network briefs to fetch records.',
              );
            }}
            onDeploy={(next) =>
              run('Deploying ProofDesk', async () => {
                if (pending)
                  throw new Error('Track the pending transaction first.');
                const hash = await deploy(next, walletSession(), setFeeQuote);
                const p: Pending = { hash, action: 'deploy', config: next };
                setPending(p);
                localStorage.setItem(PENDING_KEY, JSON.stringify(p));
                await complete(p);
                setModal(null);
              })
            }
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function BriefForm({
  existing,
  wallet,
  onSave,
}: {
  existing?: Job;
  wallet: string;
  onSave: (job: Job) => void;
}) {
  const [title, setTitle] = useState(existing?.title ?? '');
  const [criteria, setCriteria] = useState(
    existing?.requirements.join('\n') ?? '',
  );
  const [researcher, setResearcher] = useState(existing?.researcher ?? wallet);
  const [days, setDays] = useState(
    existing ? Math.ceil((existing.deadline - existing.created_at) / 86400) : 7,
  );
  const [amount, setAmount] = useState(
    existing ? formatAmount(existing.bounty_wei) : '0',
  );
  const [error, setError] = useState('');
  return (
    <form
      className="desk-form"
      onSubmit={(event) => {
        event.preventDefault();
        try {
          const requirements = criteria
            .split('\n')
            .map((x) => x.trim())
            .filter(Boolean);
          validateBrief(title, requirements, researcher, days);
          const next = newDraft(title, requirements, researcher, days, amount);
          onSave(
            existing
              ? { ...next, id: existing.id, claims: existing.claims }
              : next,
          );
        } catch (e) {
          setError((e as Error).message);
        }
      }}
    >
      <label htmlFor="brief-title">
        Research title
        <Input
          id="brief-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Compare self-hosted database options"
          required
          minLength={8}
          maxLength={160}
        />
      </label>
      <label htmlFor="brief-criteria">
        Acceptance criteria
        <Textarea
          id="brief-criteria"
          value={criteria}
          onChange={(e) => setCriteria(e.target.value)}
          placeholder={
            'Describe the PostgreSQL license conditions.\nState whether SQLite requires a license.'
          }
          rows={5}
          required
        />
      </label>
      <p className="field-hint">
        One criterion per line, up to six. Specific questions make fair reviews
        easier.
      </p>
      <label htmlFor="brief-researcher">
        Researcher wallet
        <Input
          id="brief-researcher"
          value={researcher}
          onChange={(e) => setResearcher(e.target.value)}
          placeholder="0x…"
          maxLength={42}
        />
      </label>
      <p className="field-hint">
        Only this address can submit the report. You may assign your own wallet
        for a test.
      </p>
      {wallet && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setResearcher(wallet)}
        >
          Use my connected wallet
        </Button>
      )}
      <div className="form-pair">
        <label htmlFor="brief-budget">
          Test GEN budget
          <Input
            id="brief-budget"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </label>
        <label htmlFor="brief-days">
          Days to submit
          <Input
            id="brief-days"
            type="number"
            min={1}
            max={30}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            required
          />
        </label>
      </div>
      <p className="field-hint">
        Use 0 for an unfunded test. A nonzero budget is deposited when you post
        the brief.
      </p>
      <ErrorMessage message={error} />
      <Button type="submit" className="primary-action">
        Save local draft <ArrowRight />
      </Button>
    </form>
  );
}
function ReportForm({
  claims,
  busy,
  local,
  onSave,
}: {
  claims: Claim[];
  busy: boolean;
  local: boolean;
  onSave: (claims: Claim[]) => Promise<void>;
}) {
  const [rows, setRows] = useState<Claim[]>(
    claims.length ? claims.map((c) => ({ ...c })) : [{ text: '', url: '' }],
  );
  const [error, setError] = useState('');
  return (
    <form
      className="desk-form"
      onSubmit={async (event) => {
        event.preventDefault();
        try {
          setError('');
          await onSave(validateClaims(rows));
        } catch (e) {
          setError((e as Error).message);
        }
      }}
    >
      <div className="report-inputs">
        {rows.map((row, i) => (
          <fieldset key={i} className="claim-fieldset">
            <legend>Claim {String(i + 1).padStart(2, '0')}</legend>
            <label htmlFor={`claim-text-${i}`}>
              {' '}
              Statement
              <Textarea
                id={`claim-text-${i}`}
                value={row.text}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r, n) =>
                      n === i ? { ...r, text: e.target.value } : r,
                    ),
                  )
                }
                required
                minLength={10}
                maxLength={700}
                rows={3}
              />
            </label>
            <label htmlFor={`claim-url-${i}`}>
              {' '}
              Official source URL
              <Input
                id={`claim-url-${i}`}
                type="url"
                value={row.url}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r, n) =>
                      n === i ? { ...r, url: e.target.value } : r,
                    ),
                  )
                }
                placeholder="https://www.postgresql.org/about/licence/"
                required
                maxLength={500}
              />
            </label>
            {rows.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setRows((prev) => prev.filter((_, n) => n !== i))
                }
              >
                <Trash2 /> Remove claim {i + 1}
              </Button>
            )}
          </fieldset>
        ))}
      </div>
      <div className="file-actions">
        <Button
          type="button"
          variant="outline"
          disabled={rows.length >= 8}
          onClick={() => setRows((prev) => [...prev, { text: '', url: '' }])}
        >
          <Plus /> Add claim
        </Button>
        <Button type="submit" disabled={busy}>
          {local ? 'Save report draft' : 'Submit report to GenLayer'}{' '}
          <ArrowRight />
        </Button>
      </div>
      <p className="field-hint">
        Use an approved documentation host. Claims and source URLs become public
        when submitted to GenLayer.
      </p>
      <ErrorMessage message={error} />
    </form>
  );
}
function NetworkForm({
  config,
  disabled,
  onSave,
  onDeploy,
}: {
  config: ChainConfig;
  disabled: boolean;
  onSave: (c: ChainConfig) => void;
  onDeploy: (c: ChainConfig) => Promise<void>;
}) {
  const [next, setNext] = useState(config);
  const [error, setError] = useState('');
  return (
    <div className="desk-form">
      <Tabs
        value={next.network}
        onValueChange={(value) =>
          setNext({ network: value as ChainConfig['network'], contract: '' })
        }
      >
        <TabsList>
          <TabsTrigger value="studioDevnet">Studio Next</TabsTrigger>
          <TabsTrigger value="testnetBradbury">Bradbury testnet</TabsTrigger>
        </TabsList>
      </Tabs>
      <label htmlFor="network-address">
        ProofDesk contract address
        <Input
          id="network-address"
          value={next.contract}
          onChange={(e) => setNext({ ...next, contract: e.target.value })}
          placeholder="0x…"
          maxLength={42}
        />
      </label>
      <details className="field-hint">
        <summary>Network details for manual setup</summary>
        <p>
          {networks[next.network].name} · Chain ID {networks[next.network].id} ·
          Currency {networks[next.network].nativeCurrency.symbol}
        </p>
        <p>RPC: {networks[next.network].rpcUrls.default.http[0]}</p>
      </details>
      <ErrorMessage message={error} />
      <Button
        disabled={disabled}
        onClick={() => {
          if (next.contract && !validAddress(next.contract)) {
            setError('Enter a valid contract address.');
            return;
          }
          onSave(next);
        }}
      >
        Save connection
      </Button>
      <details className="deploy-area">
        <summary>Developer options</summary>
        <p>
          To create your own ProofDesk contract, review the source and confirm
          the deployment in your wallet.
        </p>
        <a href="/contracts/proofdesk.py" target="_blank" rel="noreferrer">
          Read contract source <ArrowUpRight size={13} />
        </a>
        <Button
          variant="outline"
          disabled={disabled}
          onClick={() => onDeploy({ ...next, contract: '' })}
        >
          Deploy a new contract
        </Button>
        <p className="field-hint">
          This app pins GenLayer SDK 1.1.8 and its matching networks. Consensus
          v0.6 preview deployments need the matching SDK release candidate.
        </p>
      </details>
    </div>
  );
}
