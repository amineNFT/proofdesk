import Link from 'next/link';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'How reviews work | ProofDesk' };
export default function Method() {
  return (
    <>
      <header className="masthead">
        <Link className="wordmark" href="/">
          proofdesk<span>.</span>
        </Link>
        <Link href="/">Return to the desk ↗</Link>
      </header>
      <main className="method-page">
        <p className="eyebrow">METHOD / VERSION 1.0</p>
        <h1>What the reviewer checks.</h1>
        <p className="method-intro">
          A report earns approval when its sources support every claim and it
          addresses every agreed acceptance criterion.
        </p>
        <h2>Start with a precise brief</h2>
        <p>
          The requester writes up to six acceptance criteria, assigns a
          researcher wallet, and sets a deadline. Posting the brief fixes these
          terms on GenLayer. A test-token budget may be deposited with the
          brief. The assigned researcher submits up to eight claims, each with
          an official source URL.
        </p>
        <h2>Read the source, then judge the claim</h2>
        <ol>
          <li>
            Each validator independently retrieves the cited pages from an
            approved documentation host.
          </li>
          <li>
            The reviewer checks each claim against the retrieved text. It
            classifies the claim as supported, contradicted, or insufficiently
            evidenced.
          </li>
          <li>
            A supported or contradicted claim must include an exact passage that
            occurs in the retrieved text. An invented passage downgrades the
            result to insufficient evidence.
          </li>
          <li>
            A separate assessment checks the report against every acceptance
            criterion.
          </li>
          <li>
            Validators compare the claim verdicts, criterion verdicts, and
            overall decision. Their explanations may use different wording.
          </li>
        </ol>
        <h2>Three possible decisions</h2>
        <p>
          <strong>Approved.</strong> All claims are supported and all criteria
          are met. The researcher can claim the deposited test tokens.
        </p>
        <p>
          <strong>Needs revision.</strong> A source contradicts at least one
          claim, or the report omits an acceptance criterion. The researcher can
          submit a revised report before the deadline.
        </p>
        <p>
          <strong>Evidence missing.</strong> No contradiction or clear omission
          was found, but the evidence is incomplete or ambiguous. Payment
          remains unavailable. An unavailable page does not prove a claim false.
        </p>
        <h2>Revisions and payments</h2>
        <p>
          Every reviewed revision remains in contract history. Replacing a
          report clears the active review and requires another assessment. A
          payout can be claimed once, by the assigned researcher. Value
          transfers are emitted for finalization; a payment claim is not proof
          that the recipient has received the transfer.
        </p>
        <p>
          An unapproved brief can be refunded to its requester after the
          submission deadline. A report already awaiting review receives a
          further seven days. Approved work is reserved for the researcher and
          cannot be reclaimed through expiration.
        </p>
        <h2>What this version does not establish</h2>
        <ul>
          <li>
            A claim can be supported by a source that is itself wrong. Consensus
            does not prove universal truth.
          </li>
          <li>
            Only the listed documentation hosts are supported. The app is scoped
            to developer-tool research.
          </li>
          <li>
            Pages can change or become unavailable between validator reads.
            Disagreement may prevent a network decision.
          </li>
          <li>
            Source text is bounded to control cost. Long pages may omit relevant
            passages and lead to insufficient evidence.
          </li>
          <li>
            LLMs can misread evidence or follow adversarial text.
            Exact-quotation checks and independent review reduce some failure
            modes; they do not eliminate them.
          </li>
          <li>
            The app uses test networks. Funded escrow should not be used with
            assets of real value without a security audit and live-network
            transfer tests.
          </li>
        </ul>
        <h2>Community beta</h2>
        <p>
          Every review runs through the GenLayer contract. This beta uses a test
          network and test tokens. You can create a brief with a zero budget to
          try the full review process. For a solo test, assign your own wallet
          as the researcher.
        </p>
        <p>
          Local drafts stay in this browser. Posted briefs, researcher
          addresses, claims, URLs, and reviews are public on GenLayer. Do not
          include private research or personal data. The app never asks for a
          private key.
        </p>
        <div className="method-footer">
          <a href="/contracts/proofdesk.py" download>
            Read the contract
          </a>{' '}
          ·{' '}
          <a
            href="https://docs.genlayer.com/developers/intelligent-contracts/equivalence-principle"
            target="_blank"
            rel="noreferrer"
          >
            GenLayer validation model
          </a>{' '}
          · <Link href="/">Open the research desk</Link>
        </div>
      </main>
    </>
  );
}
