// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IAutoEvolveVerifier} from "./interfaces/IAutoEvolveVerifier.sol";

/// @title AutoEvolveRegistry
/// @notice Immutable registry for ZK-attested policy improvement snapshots.
/// @dev The generated circuit emits 13 signals in the order documented in
///      circuits/README.md. The registry validates all contextual signals before
///      it asks the Groth16 verifier to validate the arithmetic proof.
contract AutoEvolveRegistry {
    // Circom exposes main-component outputs first, followed by the public
    // inputs declared in `component main { public [...] }`.
    uint256 public constant SIGNAL_PREVIOUS_SCORE = 0;
    uint256 public constant SIGNAL_NEXT_SCORE = 1;
    uint256 public constant SIGNAL_BINDING = 2;
    uint256 public constant SIGNAL_PREVIOUS_COMMITMENT = 3;
    uint256 public constant SIGNAL_NEXT_COMMITMENT = 4;
    uint256 public constant SIGNAL_RUN_ID_LOW = 5;
    uint256 public constant SIGNAL_RUN_ID_HIGH = 6;
    uint256 public constant SIGNAL_CID_HASH_LOW = 7;
    uint256 public constant SIGNAL_CID_HASH_HIGH = 8;
    uint256 public constant SIGNAL_AGENT = 9;
    uint256 public constant SIGNAL_STAGE = 10;
    uint256 public constant SIGNAL_RUBRIC_HASH_LOW = 11;
    uint256 public constant SIGNAL_RUBRIC_HASH_HIGH = 12;

    uint256 private constant LOW_128_MASK = type(uint128).max;

    struct Run {
        address agent;
        bytes32 taskHash;
        bytes32 rubricHash;
        uint256 policyCommitment;
        uint32 score;
        uint8 version;
        string latestCid;
        bool exists;
    }

    struct MemoryPointer {
        bytes32 runId;
        address agent;
        uint8 version;
        uint32 score;
        bytes32 cidHash;
        string cid;
        bool exists;
    }

    address public immutable owner;
    IAutoEvolveVerifier public immutable verifier;
    uint256 public immutable rewardWei;
    uint256 private locked = 1;

    mapping(bytes32 runId => Run run) private runs;
    mapping(bytes32 runId => mapping(uint8 fromVersion => bool used))
        public settledTransition;
    mapping(bytes32 taskHash => MemoryPointer pointer)
        private latestVerifiedMemory;

    event EscrowFunded(address indexed funder, uint256 amount);
    event RunStarted(
        bytes32 indexed runId,
        bytes32 indexed taskHash,
        address indexed agent,
        uint256 policyCommitment,
        uint32 score,
        string cid
    );
    event ImprovementVerified(
        bytes32 indexed runId,
        bytes32 indexed taskHash,
        address indexed agent,
        uint8 fromVersion,
        uint8 toVersion,
        uint32 previousScore,
        uint32 nextScore,
        uint256 nextPolicyCommitment,
        bytes32 cidHash,
        string cid,
        uint256 reward
    );
    event ExcessWithdrawn(address indexed recipient, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "owner only");
        _;
    }

    modifier nonReentrant() {
        require(locked == 1, "reentrant call");
        locked = 2;
        _;
        locked = 1;
    }

    constructor(address verifier_, uint256 rewardWei_) {
        require(verifier_ != address(0), "verifier required");
        require(rewardWei_ > 0, "reward required");
        owner = msg.sender;
        verifier = IAutoEvolveVerifier(verifier_);
        rewardWei = rewardWei_;
    }

    receive() external payable {
        emit EscrowFunded(msg.sender, msg.value);
    }

    function fundEscrow() external payable {
        emit EscrowFunded(msg.sender, msg.value);
    }

    function startRun(
        bytes32 runId,
        bytes32 taskHash,
        bytes32 rubricHash,
        uint256 initialPolicyCommitment,
        uint32 initialScore,
        string calldata initialCid
    ) external {
        require(!runs[runId].exists, "run exists");
        require(taskHash != bytes32(0), "task required");
        require(rubricHash != bytes32(0), "rubric required");
        require(initialScore <= 100, "invalid score");
        _requireCid(initialCid);

        runs[runId] = Run({
            agent: msg.sender,
            taskHash: taskHash,
            rubricHash: rubricHash,
            policyCommitment: initialPolicyCommitment,
            score: initialScore,
            version: 1,
            latestCid: initialCid,
            exists: true
        });

        emit RunStarted(
            runId,
            taskHash,
            msg.sender,
            initialPolicyCommitment,
            initialScore,
            initialCid
        );
    }

    function settleImprovement(
        bytes32 runId,
        uint8 fromVersion,
        uint8 toVersion,
        uint256 nextPolicyCommitment,
        string calldata cid,
        IAutoEvolveVerifier.Proof calldata proof,
        uint256[13] calldata publicSignals
    ) external nonReentrant {
        Run storage run = runs[runId];
        require(run.exists, "unknown run");
        require(msg.sender == run.agent, "agent only");
        require(fromVersion == run.version, "wrong previous version");
        require(toVersion == fromVersion + 1, "invalid transition");
        require(!settledTransition[runId][fromVersion], "transition settled");
        require(address(this).balance >= rewardWei, "escrow empty");
        _requireCid(cid);

        bytes32 cidHash = keccak256(bytes(cid));
        _validatePublicSignals(
            run,
            runId,
            toVersion,
            nextPolicyCommitment,
            cidHash,
            publicSignals
        );
        require(verifier.verifyProof(proof, publicSignals), "invalid ZK proof");

        uint32 nextScore = uint32(publicSignals[SIGNAL_NEXT_SCORE]);
        settledTransition[runId][fromVersion] = true;
        run.policyCommitment = nextPolicyCommitment;
        run.score = nextScore;
        run.version = toVersion;
        run.latestCid = cid;

        latestVerifiedMemory[run.taskHash] = MemoryPointer({
            runId: runId,
            agent: msg.sender,
            version: toVersion,
            score: nextScore,
            cidHash: cidHash,
            cid: cid,
            exists: true
        });

        (bool rewardSent, ) = payable(msg.sender).call{value: rewardWei}("");
        require(rewardSent, "reward transfer failed");

        emit ImprovementVerified(
            runId,
            run.taskHash,
            msg.sender,
            fromVersion,
            toVersion,
            uint32(publicSignals[SIGNAL_PREVIOUS_SCORE]),
            nextScore,
            nextPolicyCommitment,
            cidHash,
            cid,
            rewardWei
        );
    }

    function getRun(bytes32 runId) external view returns (Run memory) {
        require(runs[runId].exists, "unknown run");
        return runs[runId];
    }

    function getLatestVerifiedMemory(
        bytes32 taskHash
    ) external view returns (MemoryPointer memory) {
        return latestVerifiedMemory[taskHash];
    }

    function withdrawExcess(
        address payable recipient,
        uint256 amount
    ) external onlyOwner nonReentrant {
        require(recipient != address(0), "recipient required");
        require(amount <= address(this).balance, "amount exceeds balance");
        (bool sent, ) = recipient.call{value: amount}("");
        require(sent, "withdraw failed");
        emit ExcessWithdrawn(recipient, amount);
    }

    function _validatePublicSignals(
        Run storage run,
        bytes32 runId,
        uint8 toVersion,
        uint256 nextPolicyCommitment,
        bytes32 cidHash,
        uint256[13] calldata publicSignals
    ) private view {
        require(
            publicSignals[SIGNAL_PREVIOUS_COMMITMENT] == run.policyCommitment,
            "previous commitment mismatch"
        );
        require(
            publicSignals[SIGNAL_NEXT_COMMITMENT] == nextPolicyCommitment,
            "next commitment mismatch"
        );
        require(
            publicSignals[SIGNAL_RUN_ID_LOW] == _low128(runId) &&
                publicSignals[SIGNAL_RUN_ID_HIGH] == _high128(runId),
            "run binding mismatch"
        );
        require(
            publicSignals[SIGNAL_CID_HASH_LOW] == _low128(cidHash) &&
                publicSignals[SIGNAL_CID_HASH_HIGH] == _high128(cidHash),
            "CID binding mismatch"
        );
        require(
            publicSignals[SIGNAL_AGENT] == uint160(msg.sender),
            "agent binding mismatch"
        );
        require(publicSignals[SIGNAL_STAGE] == toVersion, "stage mismatch");
        require(
            publicSignals[SIGNAL_RUBRIC_HASH_LOW] == _low128(run.rubricHash) &&
                publicSignals[SIGNAL_RUBRIC_HASH_HIGH] == _high128(run.rubricHash),
            "rubric binding mismatch"
        );
        require(
            publicSignals[SIGNAL_PREVIOUS_SCORE] == run.score,
            "previous score mismatch"
        );
        require(publicSignals[SIGNAL_NEXT_SCORE] <= 100, "next score invalid");
        require(
            publicSignals[SIGNAL_NEXT_SCORE] > publicSignals[SIGNAL_PREVIOUS_SCORE],
            "score did not improve"
        );
        require(publicSignals[SIGNAL_BINDING] != 0, "missing binding");
    }

    function _requireCid(string calldata cid) private pure {
        uint256 length = bytes(cid).length;
        require(length > 0 && length <= 128, "invalid CID");
    }

    function _low128(bytes32 value) private pure returns (uint256) {
        return uint256(value) & LOW_128_MASK;
    }

    function _high128(bytes32 value) private pure returns (uint256) {
        return uint256(value) >> 128;
    }
}
