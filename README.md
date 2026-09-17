# ProofDesk

ProofDesk checks whether an agent's research is supported by its citations before making its payment available. A requester fixes the brief, a researcher submits factual claims, and GenLayer validators independently inspect the evidence.

Built for Agent Tank 2026.

## Try it

The community app starts with an empty workspace. Create a brief or connect your wallet to load work you requested or were assigned. **Community** shows public network records. Built-in sample cases and simulated verdicts are confined to test fixtures and are not shipped in the interface.

For a real review, click **Connect wallet** and choose your installed Ethereum wallet, including Rabby or MetaMask. Discovery uses EIP-6963 with a legacy injected-provider fallback. Connection, network setup, and transaction signing use standard wallet requests; no MetaMask Snap is requested. The wallet must support the selected GenLayer network and Ethereum transaction signing. Open **Network settings** to pick **Studio Next** and the contract address in `lib/deployment.json`. Each write is quoted first: the network charges a fee deposit (GEN), which is refunded for whatever the transaction does not consume. Load network briefs to inspect existing records. Create a brief, assign a researcher address, post it, submit the researcher's report, and request a review. A zero budget is supported for testing.

## What is implemented

- Research briefs with 1–6 immutable acceptance criteria, an assigned researcher, and a deadline.
- Reports with 1–8 cited claims, an official-source allowlist, and bounded inputs.
- Independent source retrieval and LLM assessment by each GenLayer validator.
- Exact-quotation checks that reject invented supporting passages.
- Separate checks for factual support and coverage of the brief.
- Supported, contradicted, and insufficient-evidence verdicts per claim.
- Reviewed revision history; a revision clears the previous active verdict.
- Native test-token deposits, one-time researcher payout claims, and expired-brief refunds.
- Wallet signing, finalized-state reads, pending-transaction recovery, and Markdown receipt export.
- Device-local drafts and staged reports, with an optional WebMCP draft interface.

## Run locally

Use Node.js 22.13 or later (Node 24 was used for validation).

```sh
npm ci
npm run dev
```

Open the local URL printed by the server. No application API key is required. Reviews execute through GenLayer; the frontend does not run a centralized LLM judge.

```sh
npm run typecheck
npm test
npm run build
```

The application uses React, TypeScript, and the GenLayer JavaScript SDK. It has a Next.js build for Vercel and a Vinext build for the existing Sites preview. The blockchain stores posted records; local storage holds only device-local drafts, connection preferences, and pending-transaction identifiers.

## Deploy to Vercel

Import the repository in Vercel. The checked-in `vercel.json` selects **Next.js**, installs with `npm ci`, and builds with `npm run build:vercel`. Use **Node.js 24.x** and leave the output directory at its framework default. No environment variables are required for this release. See [the deployment guide](docs/DEPLOYMENT.md) for the exact steps and community smoke test.

To validate the same build locally:

```sh
npm run build:vercel
npm run start:vercel
```

## Contract tests

Use Python 3.12 or later.

```sh
python -m venv .venv
# macOS / Linux
.venv/bin/python -m pip install -r requirements-test.txt
.venv/bin/python -m pytest
# Windows PowerShell
.\.venv\Scripts\python.exe -m pip install -r requirements-test.txt
.\.venv\Scripts\python.exe -m pytest -p no:cacheprovider
```

Tests use the official `genlayer-test` runner (0.30.0rc2, the v0.6-compatible prerelease) in direct mode and pin GenVM v0.6.0-rc5. The first run downloads that runtime from the official GenVM releases. `tests/contracts/conftest.py` contains a Windows-only compatibility fix for the test runner's open-stdin temporary-file cleanup. It does not replace contract execution or validation logic.

## Deploy and exercise the contract

Studio Next charges a fee deposit on every deploy and write, so **fund the test
account from the faucet first**: open <https://studio-dev.genlayer.com/>, use the
account selector's 💧 button, and note the address the deployment script prints.

```sh
npm run estimate-fees                   # read-only: quote the current deposits
node scripts/deploy-studio.mjs          # deploy to Studio Next (chain 61997)
node scripts/test-studio.mjs
node scripts/test-funded-studio.mjs
node --experimental-strip-types scripts/test-wallet-studio.mjs
```

`npm run estimate-fees` signs nothing and sends nothing — it prints the live
deposit for a deploy and for each write. Run it before spending GEN.

These commands publish code and sample records to Studio Next. The deployment command creates a test-only account under ignored `.keys/`, validates the schema, saves the transaction ID before polling, and updates `lib/deployment.json` after a successful version read-back. Re-running either script resumes recorded transactions instead of blindly submitting duplicates. Never commit `.keys/` or use its test account for assets of value.

The first integration script checks an incorrect SQLite claim, a corrected revision, and a zero-budget payment claim. The funded script deposits 100 test wei and checks the recipient balance after payout. The recorded sequences in `docs/evidence/` were produced on the previous Studionet (61999) environment before this migration; see `docs/evidence/README.md`. Studio Next runs must be re-executed and the evidence regenerated there. These are simulator tokens with no monetary value.

For wallet-owned deployments, use **Deploy a new contract** in the app's network settings. The public Python source is copied from `contracts/proofdesk.py` before each build.

The wallet integration test uses the actual app client with an EIP-1193 test signer. On September 10, it finalized a brief, a report, and an approved review using only standard provider requests. Results are in `docs/evidence/studio-wallet-run.json`. This checks the signing protocol against Studio; it does not claim to test each extension's approval screens.

## Compatibility

The project pins the Consensus v0.6 release-candidate family: `genlayer-js`
2.0.0-rc.1, `@genlayer/transaction-kit` 0.1.0-rc.2 and its React adapter at the
same version, `genlayer-test` 0.30.0rc2, and GenVM v0.6.0-rc5 with the
`py-genlayer` runner declared in the contract header. Versions are pinned
exactly: a prerelease tag must be installed explicitly, because npm `latest` does
not resolve to the release candidate.

The app targets **Studio Next** (`studioDevnet`, chain 61997,
`https://studio-dev.genlayer.com/api`) and keeps Bradbury as a secondary network.
Writes are quoted before signing: allocation parameters come from the committed
`lib/fee-profile.json`, prices and caps are read live, and the returned
`distribution` and `feeValue` are submitted unchanged. A quote whose live price
caps no longer match is refused instead of signed. The deposit, the consumed
amount and the refund are reported separately once a transaction finalizes.

`lib/fee-profile.json` currently carries no measured allocations, so quotes are
labelled `network-default`. Regenerate it with `npm run test:fees` once
Studio-mode tests exist that exercise each method; allocations are only ever
measured from tests, never invented.

Bradbury deployment and transfers require separate validation.

## Review policy and limits

Approval requires every claim to be supported and every acceptance criterion to be met. An explicit contradiction or omitted criterion requires revision. Unavailable, ambiguous, or unquoted evidence leaves the result inconclusive. Validators independently re-run the assessment and compare the decision fields through a custom Equivalence Principle.

The contract evaluates source support, not universal truth. Official pages can change, and models can misread or be influenced by adversarial content. Inputs, fetched content, and output fields are bounded. The source allowlist intentionally limits this version to developer-tool research. This is an unaudited testnet application.

All posted briefs, wallet addresses, claims, source URLs, and reviews are public on GenLayer. Do not include confidential information. Local drafts stay on the device until posted.

## Project files

| Path | Purpose |
| --- | --- |
| `contracts/proofdesk.py` | GenLayer review and escrow contract |
| `components/proofdesk.tsx` | Research desk, forms, and wallet workflow |
| `lib/proofdesk.ts` | Domain validation, sample cases, and export |
| `lib/chain.ts`, `lib/receipt.ts` | SDK integration and receipt checks |
| `lib/deployment.json` | Public network and deployment identifiers |
| `tests/contracts/` | Contract state and independent-validator tests |
| `tests/app/` | Input, amount, sample, and receipt tests |
| `docs/SUBMISSION.md` | Hackathon application draft and readiness checks |
| `docs/DEMO.md` | Self-guided review and recorded-demo script |
| `docs/ARCHITECTURE.md` | Trust boundaries, storage, and decisions |

## Official references

- [Agent Tank build rules](https://portal.genlayer.foundation/agent-tank/hackathon/)
- [GenLayer Equivalence Principle](https://docs.genlayer.com/developers/intelligent-contracts/equivalence-principle)
- [GenLayer testing](https://docs.genlayer.com/developers/intelligent-contracts/testing)
- [GenLayer value transfers](https://docs.genlayer.com/developers/intelligent-contracts/features/value-transfers)

MIT licensed. The framework and bundled components retain their respective licenses.
