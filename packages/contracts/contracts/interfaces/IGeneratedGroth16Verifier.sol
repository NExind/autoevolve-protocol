// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Exact function shape emitted by snarkjs for this circuit's 13 public signals.
interface IGeneratedGroth16Verifier {
    function verifyProof(
        uint256[2] calldata pA,
        uint256[2][2] calldata pB,
        uint256[2] calldata pC,
        uint256[13] calldata pubSignals
    ) external view returns (bool);
}
