# Vercel deployment

ProofDesk is a community beta on GenLayer Studio Next (the consensus v0.6 preview environment, chain 61997). Hosting the frontend publicly does not move the contract to a production blockchain. All displayed budgets and payments are test tokens.

## Publish

1. Push this source to your GitHub repository.
2. In Vercel, choose **Add New → Project**, then import that repository.
3. Use the repository root as the root directory and **Node.js 24.x**.
4. Keep the checked-in settings: framework **Next.js**, install command `npm ci`, build command `npm run build:vercel`, and the default `.next` output directory.
5. No environment variables are needed. Deploy, then open the resulting URL in a normal browser.
6. Check Vercel's deployment protection settings before sharing the URL; community testers must be able to reach it without joining your Vercel team.

The existing `npm run build` command creates the separate Sites/Cloudflare preview. Vercel uses `build:vercel` instead. Do not upload the Sites `dist/` directory to Vercel.

## First community check

- A fresh browser should show an empty research workspace, with no sample reports or fake activity.
- Connect an Ethereum browser wallet, choose it explicitly, and approve the GenLayer Studio Next network prompts. The wallet needs GEN on chain 61997: every write reserves a fee deposit, so fund it from the 💧 faucet in the account selector at <https://studio-dev.genlayer.com/> first.
- Create a brief, assign your own wallet with **Use my connected wallet**, set the budget to `0`, and save the draft.
- Post the brief, submit a cited report, and request a review. Each action needs a separate wallet confirmation.
- Wait for finalization, or use **Check status** on the existing transaction if polling times out.
- Reload, reconnect the same wallet, and confirm the brief is in **My briefs**. Export its report from the review record.

`docs/DEMO.md` provides a concrete rejection-and-correction test. Existing public Studio test runs remain network records; removing local samples does not erase chain history.

## Data and secrets

The default network and deployed contract are in `lib/deployment.json`; these are public configuration. Wallet keys stay in the browser wallet. `.keys/`, local test outputs, and environment files are excluded from Git; `.vercelignore` also excludes local test keys from CLI uploads. No developer test account is included in the app.

Local drafts belong to a browser origin. Drafts on the private preview will not automatically appear on the new Vercel domain. Export any draft you need before switching domains. Posted records are retrieved from the same GenLayer contract on either domain.

## Validation

`npm test`, `npm run typecheck`, `npm run lint`, and `npm run build:vercel` validate the app. The contract is unchanged by this frontend release; live Studio evidence and its transaction hashes are under `docs/evidence/`.

Official reference: [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs).
