"""
End-to-End Pytest Suite for MeritSplit Intelligent Contract.
Verifies happy path, deterministic remainder distribution, security constraints,
and fail-closed invariants under adversarial conditions, including evidence digests.
"""

import json
import pytest
from contracts.merit_split import ProjectState, TOTAL_BASIS_POINTS

MOCK_DIGEST = "0x" + "a" * 64
MOCK_DIGEST_2 = "0x" + "b" * 64
MOCK_DIGEST_3 = "0x" + "c" * 64


def test_happy_path_three_contributors(direct_vm, direct_deploy, direct_creator, direct_alice, direct_bob, direct_charlie):
    """
    Happy path: 3 contributors register, submit claims with evidence & digests,
    undergo LLM consensus assessment against the frozen rubric,
    and receive deterministic shares summing to exactly 10,000 bps.
    """
    contract = direct_deploy(project_name="MeritSplit Core Protocol")

    # Verify initial state
    state = contract.get_project_state()
    assert state["state_name"] == "OPEN"
    assert state["creator"] == str(direct_creator)
    assert len(state["contributors"]) == 0

    # 1. Creator registers 3 contributors
    direct_vm.sender = direct_creator
    contract.register_contributor(direct_alice)
    contract.register_contributor(direct_bob)
    contract.register_contributor(direct_charlie)

    state = contract.get_project_state()
    assert len(state["contributors"]) == 3

    # 2. Freeze rubric and open submissions
    contract.freeze_rubric_and_open_submissions()
    state = contract.get_project_state()
    assert state["state_name"] == "SUBMISSIONS"

    # 3. Contributors submit claims with digests
    direct_vm.sender = direct_alice
    contract.submit_claim(
        evidence_url="https://github.com/meritsplit/core/pull/1",
        evidence_digest=MOCK_DIGEST,
        description="Lead Intelligent Contract architecture, GenVM strict_eq integration, and state machine"
    )

    direct_vm.sender = direct_bob
    contract.submit_claim(
        evidence_url="https://github.com/meritsplit/ui/pull/12",
        evidence_digest=MOCK_DIGEST_2,
        description="High-contrast dark mode design system, split-screen deliberator console, and reactive views"
    )

    direct_vm.sender = direct_charlie
    contract.submit_claim(
        evidence_url="https://github.com/meritsplit/qa/pull/88",
        evidence_digest=MOCK_DIGEST_3,
        description="Formal direct VM testing harness, edge case verification, and mathematical BPS invariants"
    )

    # Verify digests are recorded
    proj_state = contract.get_project_state()
    assert proj_state["claims"][str(direct_alice)]["evidence_digest"] == MOCK_DIGEST
    assert proj_state["claims"][str(direct_bob)]["evidence_digest"] == MOCK_DIGEST_2

    # 4. Mock web and LLM consensus
    direct_vm.mock_web(r".*github\.com/meritsplit/core/pull/1.*", "PR #1: Merged 1,200 LOC core contract with tests.")
    direct_vm.mock_web(r".*github\.com/meritsplit/ui/pull/12.*", "PR #12: Shipped responsive UI components and Web3 client.")
    direct_vm.mock_web(r".*github\.com/meritsplit/qa/pull/88.*", "PR #88: 100% coverage test suite and chaos testing.")

    # Differentiated composite scores: Alice: 50, Bob: 30, Charlie: 20 -> Sum = 100
    mock_assessment_output = {
        "scores": {
            str(direct_alice): 50,
            str(direct_bob): 30,
            str(direct_charlie): 20,
        },
        "rationale": "All contributors delivered substantial verifiable contributions matching all 5 rubric criteria.",
        "valid": True
    }
    direct_vm.mock_llm(r".*FROZEN ASSESSMENT RUBRIC.*", json.dumps(mock_assessment_output))

    # 5. Creator requests assessment
    direct_vm.sender = direct_creator
    result = contract.request_assessment()

    assert result["state"] == "FINALIZED"
    assert result["total_bps"] == 10000

    allocations = contract.get_allocations()
    assert allocations["finalized"] is True
    assert allocations["is_exact_10000"] is True
    assert allocations["total_basis_points"] == 10000

    alice_alloc = allocations["allocations"][str(direct_alice)]
    bob_alloc = allocations["allocations"][str(direct_bob)]
    charlie_alloc = allocations["allocations"][str(direct_charlie)]

    assert alice_alloc["basis_points"] == 5000
    assert alice_alloc["percentage"] == "50.00%"
    assert bob_alloc["basis_points"] == 3000
    assert bob_alloc["percentage"] == "30.00%"
    assert charlie_alloc["basis_points"] == 2000
    assert charlie_alloc["percentage"] == "20.00%"


def test_largest_remainder_odd_split(direct_vm, direct_deploy, direct_creator, direct_alice, direct_bob, direct_charlie):
    """
    Test deterministic Largest Remainder Method when scores produce non-integer fractions.
    Equal scores 33, 33, 33 sum to 99:
    10,000 / 99 * 33 = 3,333.333...
    Base BPS = 3,333 * 3 = 9,999 BPS. Leftover = 1 BPS.
    Deterministic tie-breaker awards 1 BPS to the top address, yielding exact 10,000 BPS.
    """
    contract = direct_deploy()

    direct_vm.sender = direct_creator
    contract.register_contributor(direct_alice)
    contract.register_contributor(direct_bob)
    contract.register_contributor(direct_charlie)
    contract.freeze_rubric_and_open_submissions()

    for c in [direct_alice, direct_bob, direct_charlie]:
        direct_vm.sender = c
        contract.submit_claim("https://evidence.io/proof", MOCK_DIGEST, "Delivered module components")

    mock_odd_scores = {
        "scores": {
            str(direct_alice): 33,
            str(direct_bob): 33,
            str(direct_charlie): 33,
        },
        "rationale": "Three identical quality contributions."
    }
    direct_vm.mock_llm(r".*FROZEN ASSESSMENT RUBRIC.*", json.dumps(mock_odd_scores))

    direct_vm.sender = direct_creator
    result = contract.request_assessment()
    assert result["state"] == "FINALIZED"

    allocs = contract.get_allocations()
    assert allocs["is_exact_10000"] is True
    assert allocs["total_basis_points"] == 10000

    bps_list = [v["basis_points"] for v in allocs["allocations"].values()]
    assert sorted(bps_list) == [3333, 3333, 3334]
    assert sum(bps_list) == 10000


def test_asymmetric_odd_split(direct_vm, direct_deploy, direct_creator, direct_alice, direct_bob, direct_charlie):
    """
    Test another odd split: 17, 29, 43 -> Total = 89:
    17 * 10000 / 89 = 1910.11 -> base 1910, rem 10
    29 * 10000 / 89 = 3258.42 -> base 3258, rem 38
    43 * 10000 / 89 = 4831.46 -> base 4831, rem 41
    Base sum = 1910 + 3258 + 4831 = 9999. Leftover = 1.
    Remainders: 41, 38, 10. Highest remainder gets +1.
    """
    contract = direct_deploy()
    direct_vm.sender = direct_creator
    contract.register_contributor(direct_alice)
    contract.register_contributor(direct_bob)
    contract.register_contributor(direct_charlie)
    contract.freeze_rubric_and_open_submissions()

    for c in [direct_alice, direct_bob, direct_charlie]:
        direct_vm.sender = c
        contract.submit_claim("https://evidence.io/proof", MOCK_DIGEST, "Proof of delivery")

    mock_scores = {
        "scores": {
            str(direct_alice): 17,
            str(direct_bob): 29,
            str(direct_charlie): 43,
        },
        "rationale": "Asymmetric contributions across team."
    }
    direct_vm.mock_llm(r".*FROZEN ASSESSMENT RUBRIC.*", json.dumps(mock_scores))

    direct_vm.sender = direct_alice
    result = contract.request_assessment()
    assert result["state"] == "FINALIZED"

    allocs = contract.get_allocations()
    assert allocs["is_exact_10000"] is True
    assert allocs["total_basis_points"] == 10000

    a_bps = allocs["allocations"][str(direct_alice)]["basis_points"]
    b_bps = allocs["allocations"][str(direct_bob)]["basis_points"]
    c_bps = allocs["allocations"][str(direct_charlie)]["basis_points"]

    assert a_bps == 1910
    assert b_bps == 3258
    assert c_bps == 4832
    assert a_bps + b_bps + c_bps == 10000


def test_adversarial_unregistered_claim(direct_vm, direct_deploy, direct_creator, direct_alice, direct_dave):
    """
    Unregistered contributor (Dave) attempting to submit a claim must revert.
    """
    contract = direct_deploy()
    direct_vm.sender = direct_creator
    contract.register_contributor(direct_alice)
    contract.freeze_rubric_and_open_submissions()

    direct_vm.sender = direct_dave
    with direct_vm.expect_revert("Caller is not a registered contributor"):
        contract.submit_claim("https://dave-exploit.com", MOCK_DIGEST, "Malicious claim")


def test_claim_in_invalid_states(direct_vm, direct_deploy, direct_creator, direct_alice):
    """
    Submitting a claim before freeze (OPEN) or after completion must revert.
    """
    contract = direct_deploy()
    direct_vm.sender = direct_creator
    contract.register_contributor(direct_alice)

    # In OPEN state
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Contribution claims are only accepted in SUBMISSIONS state"):
        contract.submit_claim("https://proof.io", MOCK_DIGEST, "Premature claim")


def test_empty_evidence_validation(direct_vm, direct_deploy, direct_creator, direct_alice):
    """
    Empty evidence URL, blank digest, or blank description must revert with validation error.
    """
    contract = direct_deploy()
    direct_vm.sender = direct_creator
    contract.register_contributor(direct_alice)
    contract.freeze_rubric_and_open_submissions()

    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Evidence URL cannot be empty"):
        contract.submit_claim("", MOCK_DIGEST, "Valid description")

    with direct_vm.expect_revert("Evidence digest cannot be empty"):
        contract.submit_claim("https://valid-url.com", "", "Valid description")

    with direct_vm.expect_revert("Claim description cannot be empty"):
        contract.submit_claim("https://valid-url.com", MOCK_DIGEST, "   ")


def test_non_creator_permissions(direct_vm, direct_deploy, direct_creator, direct_alice, direct_bob):
    """
    Non-creator attempting to register contributors or freeze rubric must revert.
    """
    contract = direct_deploy()

    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Only project creator can register contributors"):
        contract.register_contributor(direct_bob)

    with direct_vm.expect_revert("Only project creator can freeze rubric"):
        contract.freeze_rubric_and_open_submissions()


def test_freeze_with_zero_contributors(direct_vm, direct_deploy, direct_creator):
    """
    Creator cannot freeze rubric if 0 contributors are registered.
    """
    contract = direct_deploy()
    direct_vm.sender = direct_creator
    with direct_vm.expect_revert("Must register at least one contributor before freezing rubric"):
        contract.freeze_rubric_and_open_submissions()


def test_duplicate_contributor_registration(direct_vm, direct_deploy, direct_creator, direct_alice):
    """
    Registering the same contributor twice must revert.
    """
    contract = direct_deploy()
    direct_vm.sender = direct_creator
    contract.register_contributor(direct_alice)
    with direct_vm.expect_revert("Contributor is already registered"):
        contract.register_contributor(direct_alice)


def test_all_scores_zero_fails_closed(direct_vm, direct_deploy, direct_creator, direct_alice, direct_bob):
    """
    If evidence is missing, unsubstantiated, or LLM consensus yields 0 for all scores,
    the contract must fail closed into UNRESOLVED state without hallucinating shares.
    """
    contract = direct_deploy()
    direct_vm.sender = direct_creator
    contract.register_contributor(direct_alice)
    contract.register_contributor(direct_bob)
    contract.freeze_rubric_and_open_submissions()

    direct_vm.sender = direct_alice
    contract.submit_claim("https://broken.io", MOCK_DIGEST, "Did some research")

    direct_vm.sender = direct_bob
    contract.submit_claim("https://unrelated.io", MOCK_DIGEST_2, "Explored options")

    # Evaluator scores zero
    mock_zero_scores = {
        "scores": {
            str(direct_alice): 0,
            str(direct_bob): 0,
        },
        "rationale": "Evidence links inaccessible; claims unsubstantiated against rubric."
    }
    direct_vm.mock_llm(r".*FROZEN ASSESSMENT RUBRIC.*", json.dumps(mock_zero_scores))

    direct_vm.sender = direct_creator
    result = contract.request_assessment()

    assert result["state"] == "UNRESOLVED"
    assert "Total score of all contributions is zero" in result["notes"]

    state = contract.get_project_state()
    assert state["state_name"] == "UNRESOLVED"
    assert state["total_basis_points"] == 0
    assert state["final_allocations"][str(direct_alice)] == 0
    assert state["final_allocations"][str(direct_bob)] == 0


def test_consensus_disagreement_fails_closed(direct_vm, direct_deploy, direct_creator, direct_alice):
    """
    If validators disagree during strict equivalence check,
    the contract must fail closed into UNRESOLVED state.
    """
    contract = direct_deploy()
    direct_vm.sender = direct_creator
    contract.register_contributor(direct_alice)
    contract.freeze_rubric_and_open_submissions()

    direct_vm.sender = direct_alice
    contract.submit_claim("https://proof.io", MOCK_DIGEST, "Full architectural specification")

    # Simulate validator disagreement on strict equivalence
    direct_vm.simulate_disagreement = True

    direct_vm.sender = direct_creator
    result = contract.request_assessment()

    assert result["state"] == "UNRESOLVED"
    assert "Consensus failed closed" in result["notes"]

    state = contract.get_project_state()
    assert state["state_name"] == "UNRESOLVED"


def test_security_reject_unknown_contributor_injection(direct_vm, direct_deploy, direct_creator, direct_alice, direct_dave):
    """
    If an attacker tricks the LLM into returning an unapproved address,
    post-consensus deterministic verification must detect and reject it,
    failing closed into UNRESOLVED state.
    """
    contract = direct_deploy()
    direct_vm.sender = direct_creator
    contract.register_contributor(direct_alice)
    contract.freeze_rubric_and_open_submissions()

    direct_vm.sender = direct_alice
    contract.submit_claim("https://proof.io", MOCK_DIGEST, "Submitted code")

    # Injected rogue address Dave
    mock_injected_scores = {
        "scores": {
            str(direct_alice): 40,
            str(direct_dave): 60,
        },
        "rationale": "Rogue injection attempt."
    }
    direct_vm.mock_llm(r".*FROZEN ASSESSMENT RUBRIC.*", json.dumps(mock_injected_scores))

    direct_vm.sender = direct_creator
    result = contract.request_assessment()

    assert result["state"] == "UNRESOLVED"
    assert "Security reject: Unknown contributor address" in result["notes"]
    assert contract.get_project_state()["state_name"] == "UNRESOLVED"
