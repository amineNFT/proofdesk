# Agent Tank application draft

## Project name

ProofDesk

## Short description

ProofDesk checks an AI agent's research against its citations before making the agent's payment available. GenLayer validators independently review the sources and the agreed brief.

## Problem

A research agent can deliver a fluent report with real-looking citations that do not support its claims. The buyer either pays for unchecked work or repeats the research. A link alone is not evidence that the report is correct.

## Product

The requester writes acceptance criteria, assigns a researcher, and optionally deposits a test-token budget. The researcher submits up to eight factual claims with official sources. ProofDesk shows which claims are supported, contradicted, or missing evidence, alongside source passages and explanations. The researcher can correct a rejected report. The contract preserves reviewed revisions and makes payment claimable only after approval.

## Why GenLayer

The contested decision is whether natural-language research satisfies a brief and is supported by external evidence. Ordinary deterministic checks can validate a URL or match a quote, but do not establish whether the quote supports a claim. A centralized model would leave the buyer and researcher trusting one operator's judgment. GenLayer validators independently fetch and interpret the evidence, then apply a custom Equivalence Principle to the decision fields.

## Demonstration

The walkthrough starts with an incorrect claim that SQLite requires a paid commercial license. The cited page says the deliverable library is in the public domain. ProofDesk flags the contradiction. The researcher corrects it, requests a new review, and becomes eligible to claim a funded budget. Contract tests also cover insufficient evidence when a source cannot be retrieved.

The community app contains no built-in samples or simulated verdicts. A live Studio sequence passed on the earlier Studionet environment: rejection, corrected revision, approval, and payment claim, with a separate funded run observing delivery of a 100-wei simulator-token deposit. Those records are kept in `docs/evidence/`, and they are pre-migration: the Studio Next deployment required for this submission must regenerate them (`docs/evidence/README.md`).

## Implementation

React and TypeScript research desk; Python Intelligent Contract; GenLayer JS wallet integration; native test-token escrow; independent source and scope evaluation; revision history; Markdown evidence receipts; contract and application tests. There is no centralized verdict API.

## Deployment

Network: **Studio Next** — the environment the hackathon requires. It is the
consensus v0.6 preview, chain **61997**, canonical RPC
`https://studio-dev.genlayer.com/api` (the announcement's
`studio-next.genlayer.com/api` is the same environment). The app, the contract
runner and the test toolchain are pinned to the v0.6 release-candidate family.

Contract and network: see `lib/deployment.json`. The previous Studionet (61999)
address does not exist on Studio Next, so the contract is redeployed there and
the recorded integration evidence must be regenerated (`docs/evidence/README.md`).

## Current limits

The source allowlist focuses on official developer documentation. A quoted source can itself be wrong. Model disagreement can delay or prevent a decision. The contract is unaudited. Studio Next is a release-candidate environment that may reset, and its fee accounting can change; validation there, including any observed simulator-token transfer, does not establish Bradbury compatibility or production readiness.

## Submission checklist

The public hackathon page was checked on September 9, 2026. It states:

- One project per portal account; editable until submissions close.
- A public GitHub repository and full project application are required.
- Accepted builds appear in Project Explorer.
- The panel reviews builds; the community can rate and comment.
- Submissions close September 17 at 15:30 UTC; winners are announced September 25.

Source: https://portal.genlayer.foundation/agent-tank/hackathon/

Before final portal submission:

- [ ] Verify the public GitHub repository opens without signing in.
- [ ] Confirm the project is the builder's only hackathon entry, or update the existing entry.
- [ ] Enter the final repository, demo, and contract links in the account's full application.
- [ ] If including the hosted demo, make sure judges can access it.
- [ ] Recheck any account-only fields and terms shown in the portal.
- [ ] Submit before the deadline and retain the portal confirmation.

The published page does not list mandatory live pitching. This repository includes a written walkthrough and an optional recorded-demo script. Portal participation and final submission are separate from publishing the code.
