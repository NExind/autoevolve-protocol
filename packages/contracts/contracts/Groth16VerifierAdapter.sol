// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IAutoEvolveVerifier} from "./interfaces/IAutoEvolveVerifier.sol";
import {IGeneratedGroth16Verifier} from "./interfaces/IGeneratedGroth16Verifier.sol";

/// @notice Makes the generated snarkjs verifier consumable by the registry.
/// @dev Deploy this only after generating and deploying the verifier from the
///      circuit's final zkey. It contains no trust or upgrade switch.
contract Groth16VerifierAdapter is IAutoEvolveVerifier {
    IGeneratedGroth16Verifier public immutable generatedVerifier;

    constructor(address generatedVerifier_) {
        require(generatedVerifier_ != address(0), "verifier required");
        generatedVerifier = IGeneratedGroth16Verifier(generatedVerifier_);
    }

    function verifyProof(
        Proof calldata proof,
        uint256[13] calldata publicSignals
    ) external view returns (bool) {
        return
            generatedVerifier.verifyProof(
                proof.a,
                proof.b,
                proof.c,
                publicSignals
            );
    }
}
