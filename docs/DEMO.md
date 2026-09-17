# ProofDesk demo

## Real network walkthrough

1. Click **Connect wallet**, select your Ethereum wallet, and approve the connection and network prompts.
2. Click **New brief**. Use the title `SQLite licensing check` and one acceptance criterion: `Explain whether the SQLite library requires a paid license for commercial use.`
3. Click **Use my connected wallet** to assign yourself as the researcher. Set the budget to `0`, keep seven days, and save the draft.
4. Click **Post brief to GenLayer** and approve. After finalization, click **Submit report**.
5. Enter the deliberately incorrect claim `The SQLite library requires every commercial user to purchase a paid license.` with source `https://www.sqlite.org/copyright.html`. Click **Submit report to GenLayer** and approve.
6. Click **Request review**. The expected decision is **Needs revision**, with the licensing claim marked **Contradicted**.
7. Click **Submit a revision**. Replace the claim with `SQLite's deliverable library is dedicated to the public domain and may be used commercially without purchasing a license.` Keep the same source.
8. Submit and request another review. The expected decision is **Approved**. Investigate an inconclusive result rather than substituting a local verdict.
9. Open **Review record**, load revision history, and export the Markdown receipt. Reload and reconnect to find the record under **My briefs**.

The community interface contains no simulated reviews. Each action submits a real test-network transaction. Allow time for finalization before continuing. Every write is quoted first, so the demo also shows the fee receipt (deposit, and consumed/refunded once finalized); the network's test tokens come from the 💧 faucet in the account selector at <https://studio-dev.genlayer.com/>.

## Live contract walkthrough

Use **Check status** for a pending transaction instead of sending it again. The zero-budget test verifies review and persistence; it does not transfer tokens. A claim-payment button appears only when an approved brief has a nonzero budget.

GenLayer reviews may take longer than a short recording. Use the saved transaction hashes and finalized records as evidence. Do not replace a live network wait with an unlabeled simulated result.

## Optional 90-second recorded narration

“This research agent says SQLite requires a paid commercial license. It cites the official SQLite page. The page says the opposite.

ProofDesk lets a buyer agree on a research brief before the work starts. The researcher submits claims with sources. GenLayer validators independently read those sources and check both factual support and coverage of the brief.

Here, the licensing claim is contradicted. The payment remains unavailable. The researcher corrects the claim and submits a new revision. The first review stays in the record.

When the corrected report passes, the researcher can claim the budget. If a source is unavailable, the result stays unresolved. We don't interpret a failed fetch as proof that a claim is false.

The repository includes the Python contract, tests, and deployment instructions. Connect a wallet to submit your own report, or inspect the public Studio records.”

Use screenshots or recordings of the actual app. If waiting is cut from a recording, label the edit. Do not claim funded settlement from the zero-budget integration.
