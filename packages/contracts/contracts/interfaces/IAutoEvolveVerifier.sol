// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Adapter interface around a snarkjs-generated 13-signal Groth16 verifier.
interface IAutoEvolveVerifier {
    struct Proof {
        uint256[2] a;
        uint256[2][2] b;
        uint256[2] c;
    }

    function verifyProof(
        Proof calldata proof,
        uint256[13] calldata publicSignals
    ) external view returns (bool);
}
