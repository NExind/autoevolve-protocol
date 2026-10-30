pragma circom 2.1.6;

include "circomlib/circuits/bitify.circom";
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/poseidon.circom";

template BooleanSignal() {
    signal input in;
    in * (in - 1) === 0;
}

template PositiveAtMost(bits, maximum) {
    signal input in;
    signal output out;

    component range = Num2Bits(bits);
    range.in <== in;
    component positive = LessThan(bits);
    positive.in[0] <== 0;
    positive.in[1] <== in;
    component atMost = LessEqThan(bits);
    atMost.in[0] <== in;
    atMost.in[1] <== maximum;
    out <== positive.out * atMost.out;
}

template AtLeast(bits, minimum) {
    signal input in;
    signal output out;

    component range = Num2Bits(bits);
    range.in <== in;
    component comparator = LessEqThan(bits);
    comparator.in[0] <== minimum;
    comparator.in[1] <== in;
    out <== comparator.out;
}

template PolicyScore() {
    signal input requireConsent;
    signal input redactDirectIdentifiers;
    signal input researchPurposeOnly;
    signal input auditLogging;
    signal input blockRestrictedRegions;
    signal input requireDualApprovalHighVolume;
    signal input minKAnonymity;
    signal input maxExportRows;
    signal input retentionDays;
    signal input dailyRequestLimit;
    signal output score;

    component consent = BooleanSignal();
    component redact = BooleanSignal();
    component research = BooleanSignal();
    component audit = BooleanSignal();
    component region = BooleanSignal();
    component dualApproval = BooleanSignal();
    consent.in <== requireConsent;
    redact.in <== redactDirectIdentifiers;
    research.in <== researchPurposeOnly;
    audit.in <== auditLogging;
    region.in <== blockRestrictedRegions;
    dualApproval.in <== requireDualApprovalHighVolume;

    component minK = AtLeast(8, 5);
    minK.in <== minKAnonymity;
    component maxRows = PositiveAtMost(14, 10000);
    maxRows.in <== maxExportRows;
    component retention = PositiveAtMost(6, 30);
    retention.in <== retentionDays;
    component dailyLimit = PositiveAtMost(7, 100);
    dailyLimit.in <== dailyRequestLimit;

    score <== 10 * (
        requireConsent +
        redactDirectIdentifiers +
        researchPurposeOnly +
        auditLogging +
        blockRestrictedRegions +
        requireDualApprovalHighVolume +
        minK.out +
        maxRows.out +
        retention.out +
        dailyLimit.out
    );
}

template PolicyCommitment() {
    signal input requireConsent;
    signal input redactDirectIdentifiers;
    signal input researchPurposeOnly;
    signal input auditLogging;
    signal input blockRestrictedRegions;
    signal input requireDualApprovalHighVolume;
    signal input minKAnonymity;
    signal input maxExportRows;
    signal input retentionDays;
    signal input dailyRequestLimit;
    signal output commitment;

    component left = Poseidon(5);
    left.inputs[0] <== requireConsent;
    left.inputs[1] <== redactDirectIdentifiers;
    left.inputs[2] <== researchPurposeOnly;
    left.inputs[3] <== auditLogging;
    left.inputs[4] <== blockRestrictedRegions;

    component right = Poseidon(5);
    right.inputs[0] <== requireDualApprovalHighVolume;
    right.inputs[1] <== minKAnonymity;
    right.inputs[2] <== maxExportRows;
    right.inputs[3] <== retentionDays;
    right.inputs[4] <== dailyRequestLimit;

    component root = Poseidon(2);
    root.inputs[0] <== left.out;
    root.inputs[1] <== right.out;
    commitment <== root.out;
}

template AutoEvolveImprovement() {
    signal input previousRequireConsent;
    signal input previousRedactDirectIdentifiers;
    signal input previousResearchPurposeOnly;
    signal input previousAuditLogging;
    signal input previousBlockRestrictedRegions;
    signal input previousRequireDualApprovalHighVolume;
    signal input previousMinKAnonymity;
    signal input previousMaxExportRows;
    signal input previousRetentionDays;
    signal input previousDailyRequestLimit;

    signal input nextRequireConsent;
    signal input nextRedactDirectIdentifiers;
    signal input nextResearchPurposeOnly;
    signal input nextAuditLogging;
    signal input nextBlockRestrictedRegions;
    signal input nextRequireDualApprovalHighVolume;
    signal input nextMinKAnonymity;
    signal input nextMaxExportRows;
    signal input nextRetentionDays;
    signal input nextDailyRequestLimit;

    signal input previousPolicyCommitment;
    signal input nextPolicyCommitment;
    signal input runIdLow;
    signal input runIdHigh;
    signal input cidHashLow;
    signal input cidHashHigh;
    signal input agent;
    signal input stage;
    signal input rubricHashLow;
    signal input rubricHashHigh;

    signal output previousScore;
    signal output nextScore;
    signal output binding;

    component previous = PolicyScore();
    previous.requireConsent <== previousRequireConsent;
    previous.redactDirectIdentifiers <== previousRedactDirectIdentifiers;
    previous.researchPurposeOnly <== previousResearchPurposeOnly;
    previous.auditLogging <== previousAuditLogging;
    previous.blockRestrictedRegions <== previousBlockRestrictedRegions;
    previous.requireDualApprovalHighVolume <== previousRequireDualApprovalHighVolume;
    previous.minKAnonymity <== previousMinKAnonymity;
    previous.maxExportRows <== previousMaxExportRows;
    previous.retentionDays <== previousRetentionDays;
    previous.dailyRequestLimit <== previousDailyRequestLimit;
    previousScore <== previous.score;

    component next = PolicyScore();
    next.requireConsent <== nextRequireConsent;
    next.redactDirectIdentifiers <== nextRedactDirectIdentifiers;
    next.researchPurposeOnly <== nextResearchPurposeOnly;
    next.auditLogging <== nextAuditLogging;
    next.blockRestrictedRegions <== nextBlockRestrictedRegions;
    next.requireDualApprovalHighVolume <== nextRequireDualApprovalHighVolume;
    next.minKAnonymity <== nextMinKAnonymity;
    next.maxExportRows <== nextMaxExportRows;
    next.retentionDays <== nextRetentionDays;
    next.dailyRequestLimit <== nextDailyRequestLimit;
    nextScore <== next.score;

    component strictlyImproves = LessThan(8);
    strictlyImproves.in[0] <== previousScore;
    strictlyImproves.in[1] <== nextScore;
    strictlyImproves.out === 1;

    component previousCommitment = PolicyCommitment();
    previousCommitment.requireConsent <== previousRequireConsent;
    previousCommitment.redactDirectIdentifiers <== previousRedactDirectIdentifiers;
    previousCommitment.researchPurposeOnly <== previousResearchPurposeOnly;
    previousCommitment.auditLogging <== previousAuditLogging;
    previousCommitment.blockRestrictedRegions <== previousBlockRestrictedRegions;
    previousCommitment.requireDualApprovalHighVolume <== previousRequireDualApprovalHighVolume;
    previousCommitment.minKAnonymity <== previousMinKAnonymity;
    previousCommitment.maxExportRows <== previousMaxExportRows;
    previousCommitment.retentionDays <== previousRetentionDays;
    previousCommitment.dailyRequestLimit <== previousDailyRequestLimit;
    previousCommitment.commitment === previousPolicyCommitment;

    component nextCommitment = PolicyCommitment();
    nextCommitment.requireConsent <== nextRequireConsent;
    nextCommitment.redactDirectIdentifiers <== nextRedactDirectIdentifiers;
    nextCommitment.researchPurposeOnly <== nextResearchPurposeOnly;
    nextCommitment.auditLogging <== nextAuditLogging;
    nextCommitment.blockRestrictedRegions <== nextBlockRestrictedRegions;
    nextCommitment.requireDualApprovalHighVolume <== nextRequireDualApprovalHighVolume;
    nextCommitment.minKAnonymity <== nextMinKAnonymity;
    nextCommitment.maxExportRows <== nextMaxExportRows;
    nextCommitment.retentionDays <== nextRetentionDays;
    nextCommitment.dailyRequestLimit <== nextDailyRequestLimit;
    nextCommitment.commitment === nextPolicyCommitment;

    component metadata = Poseidon(8);
    metadata.inputs[0] <== runIdLow;
    metadata.inputs[1] <== runIdHigh;
    metadata.inputs[2] <== cidHashLow;
    metadata.inputs[3] <== cidHashHigh;
    metadata.inputs[4] <== agent;
    metadata.inputs[5] <== stage;
    metadata.inputs[6] <== rubricHashLow;
    metadata.inputs[7] <== rubricHashHigh;

    component finalBinding = Poseidon(3);
    finalBinding.inputs[0] <== previousPolicyCommitment;
    finalBinding.inputs[1] <== nextPolicyCommitment;
    finalBinding.inputs[2] <== metadata.out;
    binding <== finalBinding.out;
}

component main {
    public [
        previousPolicyCommitment,
        nextPolicyCommitment,
        runIdLow,
        runIdHigh,
        cidHashLow,
        cidHashHigh,
        agent,
        stage,
        rubricHashLow,
        rubricHashHigh
    ]
} = AutoEvolveImprovement();
