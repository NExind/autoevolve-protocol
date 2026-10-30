// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IAutoEvolveVerifier} from "../interfaces/IAutoEvolveVerifier.sol";

/// @dev Local-test-only verifier. Never deploy this in the hackathon submission.
contract MockVerifier is IAutoEvolveVerifier {
    bool public result = true;

    function setResult(bool result_) external {
        result = result_;
    }

    function verifyProof(
        Proof calldata,
        uint256[13] calldata
    ) external view returns (bool) {
        return result;
    }
}
