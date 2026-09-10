// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice Pinned from @somnia-chain/markets-sdk@0.29.0 + Sequence Verified.sol
library Verified {
    address internal constant REACTIVITY_PRECOMPILE = address(0x0100);
    address internal constant ORACLE_HUB = 0xe40db387cC98601Dd11bd634fF2f3AD5686dE32b;
    address internal constant BINARY_MODULE = 0x3ecC694Cef705358864a646142ac17A90E29e388;
    bytes32 internal constant ANSWER_DELIVERED_TOPIC0 =
        0x981074cb1e0ea7eac4cbc8c4c9ddbef8b964373e7e8cd0904c8e0951c4430541;
    uint8 internal constant STATUS_TRADING = 1;
    uint8 internal constant STATUS_RESOLVED = 4;
    uint8 internal constant STATUS_VOIDED = 5;
}
