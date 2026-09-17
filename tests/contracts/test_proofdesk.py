import json
import pytest

URL = "https://www.sqlite.org/copyright.html"
QUOTE = "All of the code and documentation in SQLite has been dedicated to the public domain."

@pytest.fixture
def desk(direct_vm, direct_deploy, direct_bob):
    direct_vm.warp("2026-09-09T12:00:00Z")
    contract = direct_deploy("contracts/proofdesk.py", sdk_version="v0.2.16")
    contract.create_brief("test-001", "Check the SQLite license", json.dumps(["State whether SQLite requires a license fee."]), "0x" + direct_bob.hex(), 7)
    return contract

def submit(desk, vm, researcher, claim="SQLite does not require a license fee.", url=URL):
    with vm.prank(researcher):
        desk.submit_report("test-001", json.dumps([{"text": claim, "url": url}]))

def mock_review(vm, verdict="supported", scope="met", quote=QUOTE, status=200):
    vm.mock_web(r"sqlite\.org", {"status": status, "body": QUOTE})
    vm.mock_llm(r"PROOFDESK_CLAIM_REVIEW", {"verdict": verdict, "quote": quote, "reason": "The page states its licensing terms."})
    vm.mock_llm(r"PROOFDESK_SCOPE_REVIEW", {"criteria": [{"verdict": scope, "reason": "The license question is addressed."}]})

def state(desk):
    return json.loads(desk.get_brief("test-001"))

def test_supported_report_approved(desk, direct_vm, direct_bob):
    submit(desk, direct_vm, direct_bob)
    mock_review(direct_vm)
    desk.review_report("test-001")
    assert state(desk)["status"] == "approved"
    assert direct_vm.run_validator() is True

def test_contradiction_requires_revision(desk, direct_vm, direct_bob):
    submit(desk, direct_vm, direct_bob, "SQLite requires a paid commercial license.")
    mock_review(direct_vm, "contradicted")
    desk.review_report("test-001")
    assert state(desk)["status"] == "needs_revision"

def test_missing_source_never_approves(desk, direct_vm, direct_bob):
    submit(desk, direct_vm, direct_bob)
    mock_review(direct_vm, status=404)
    desk.review_report("test-001")
    assert state(desk)["status"] == "inconclusive"

def test_fabricated_quote_cannot_support_claim(desk, direct_vm, direct_bob):
    submit(desk, direct_vm, direct_bob)
    mock_review(direct_vm, quote="This passage was invented by a reviewer.")
    desk.review_report("test-001")
    assert state(desk)["status"] == "inconclusive"

def test_scope_omission_blocks_payment(desk, direct_vm, direct_bob):
    submit(desk, direct_vm, direct_bob)
    mock_review(direct_vm, scope="unmet")
    desk.review_report("test-001")
    assert state(desk)["status"] == "needs_revision"
    with direct_vm.prank(direct_bob), direct_vm.expect_revert("Payment is not available"):
        desk.claim_payout("test-001")

def test_independent_validator_rejects_disagreement(desk, direct_vm, direct_bob):
    submit(desk, direct_vm, direct_bob)
    mock_review(direct_vm)
    desk.review_report("test-001")
    direct_vm.clear_mocks()
    mock_review(direct_vm, "contradicted")
    assert direct_vm.run_validator() is False

def test_unauthorized_submit_and_review(desk, direct_vm, direct_charlie):
    with direct_vm.prank(direct_charlie), direct_vm.expect_revert("Only the assigned researcher"):
        desk.submit_report("test-001", "[]")
    with direct_vm.prank(direct_charlie), direct_vm.expect_revert("Only the requester or researcher"):
        desk.review_report("test-001")

@pytest.mark.parametrize("url", ["https://127.0.0.1/", "http://www.sqlite.org/copyright.html", "https://www.sqlite.org.evil.com/", "https://www.sqlite.org@evil.com/", "https://www.sqlite.org:443/copyright.html", "https://www.sqlite.org/copyright.html?redirect=evil", "https://localhost/", "https://www.sqlite.org\\@evil.com/"])
def test_source_url_restrictions(desk, direct_vm, direct_bob, url):
    with direct_vm.expect_revert():
        submit(desk, direct_vm, direct_bob, url=url)

def test_revision_retains_history(desk, direct_vm, direct_bob):
    submit(desk, direct_vm, direct_bob)
    mock_review(direct_vm, "contradicted")
    desk.review_report("test-001")
    submit(desk, direct_vm, direct_bob)
    assert state(desk)["review"] is None
    assert state(desk)["revision"] == 2
    assert json.loads(desk.get_revision("test-001", 1))["status"] == "needs_revision"

def test_double_payment_blocked(desk, direct_vm, direct_bob):
    submit(desk, direct_vm, direct_bob)
    mock_review(direct_vm)
    desk.review_report("test-001")
    with direct_vm.prank(direct_bob):
        desk.claim_payout("test-001")
        with direct_vm.expect_revert("Payment is not available"):
            desk.claim_payout("test-001")

def test_expired_open_brief_refunded(desk, direct_vm):
    with direct_vm.expect_revert("Refund is not available"):
        desk.refund_expired("test-001")
    direct_vm.warp("2026-09-17T12:00:00Z")
    desk.refund_expired("test-001")
    assert state(desk)["status"] == "refunded"
    with direct_vm.expect_revert("Refund is not available"):
        desk.refund_expired("test-001")

def test_submission_has_review_grace_period(desk, direct_vm, direct_bob):
    submit(desk, direct_vm, direct_bob)
    direct_vm.warp("2026-09-17T12:00:00Z")
    with direct_vm.expect_revert("Refund is not available"):
        desk.refund_expired("test-001")
    direct_vm.warp("2026-09-24T12:00:00Z")
    desk.refund_expired("test-001")
    assert state(desk)["status"] == "refunded"
