# ProofDesk

ProofDesk checks whether an agent's research is supported by its citations before making its payment available. A requester fixes the brief, a researcher submits factual claims, and GenLayer validators independently inspect the evidence.

Built for Agent Tank 2026 by [0x-normal](https://github.com/0x-normal).

## Try it

The community app starts with an empty workspace. Create a brief or connect your wallet to load work you requested or were assigned. **Community** shows public network records. Built-in sample cases and simulated verdicts are confined to test fixtures and are not shipped in the interface.

For a real review, click **Connect wallet** and choose your installed Ethereum wallet, including Rabby or MetaMask. Discovery uses EIP-6963 with a legacy injected-provider fallback. Connection, network setup, and transaction signing use standard wallet requests; no MetaMask Snap is requested. The wallet must support the selected GenLayer network and Ethereum transaction signing. Open **Network settings** and use the Studio contract in `lib/deployment.json`. Load network briefs to inspect existing records. Create a brief, assign a researcher address, post it, submit the researcher's report, and request a review. A zero budget is supported for testing.

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

Tests use the official `genlayer-test` direct-mode runner and pin GenVM v0.2.16. The first run downloads that runtime from the official GenVM releases. `tests/contracts/conftest.py` contains a Windows-only compatibility fix for the test runner's open-stdin temporary-file cleanup. It does not replace contract execution or validation logic.

## Deploy and exercise the contract

```sh
node scripts/deploy-studio.mjs
node scripts/test-studio.mjs
node scripts/test-funded-studio.mjs
node --experimental-strip-types scripts/test-wallet-studio.mjs
```

These commands publish code and sample records to GenLayer Studio. The deployment command creates a test-only account under ignored `.keys/`, validates the schema, saves the transaction ID before polling, and updates `lib/deployment.json` after a successful version read-back. Re-running either script resumes recorded transactions instead of blindly submitting duplicates. Never commit `.keys/` or use its test account for assets of value.

The first integration script checks an incorrect SQLite claim, a corrected revision, and a zero-budget payment claim. The funded script uses Studio's simulator faucet, deposits 100 test wei, and checks the recipient balance after payout. Both sequences passed on September 9, 2026; transaction hashes and results are in `docs/evidence/studio-run.json` and `docs/evidence/studio-funded-run.json`. The funded run observed the 100-wei transfer. These are simulator tokens with no monetary value.

For wallet-owned deployments, use **Deploy a new contract** in the app's network settings. The public Python source is copied from `contracts/proofdesk.py` before each build.

The wallet integration test uses the actual app client with an EIP-1193 test signer. On September 10, it finalized a brief, a report, and an approved review using only standard provider requests. Results are in `docs/evidence/studio-wallet-run.json`. This checks the signing protocol against Studio; it does not claim to test each extension's approval screens.

## Compatibility

The project pins `genlayer-js` 1.1.8, the stable SDK used for its Studio deployment. It exposes that SDK's Studio and Bradbury chain definitions. The newer Consensus v0.6 preview requires its matching SDK release candidate and fee-policy integration; do not point this client at a preview RPC under an old chain definition. Bradbury deployment and transfers require separate validation.

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
