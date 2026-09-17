# Evidence records

These files are **outputs of earlier runs**, kept as they were recorded. Read
them with their network in mind.

- `studio-run.json`, `studio-funded-run.json`, `studio-wallet-run.json` were
  produced on **Studionet (chain 61999)** on September 9–10, 2026, before this
  project moved to Studio Next.
- They are not evidence for the Studio Next (chain 61997) deployment the
  hackathon requires. The transaction hashes are still valid on that older
  environment, and the contract source they exercised is the pre-v0.6 one.

To produce Studio Next evidence, fund an account from the faucet at
<https://studio-dev.genlayer.com/>, deploy, then re-run the integration scripts:

```sh
npm run estimate-fees
node scripts/deploy-studio.mjs
node scripts/test-studio.mjs
node scripts/test-funded-studio.mjs
node --experimental-strip-types scripts/test-wallet-studio.mjs
```

Each script rewrites its own file here only after the recorded transactions
finalize successfully, and every write now carries a quoted fee deposit, so the
regenerated records also show what the fee path actually submitted.
