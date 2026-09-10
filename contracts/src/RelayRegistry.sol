// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {RunnerVault} from "./RunnerVault.sol";

/// @notice Metadata registry. Not financial truth.
contract RelayRegistry {
    error NotVaultOwner();
    error ZeroVault();

    event Registered(address indexed owner, address indexed vault, bytes32 configHash);

    mapping(address => address) public vaultOf;
    mapping(address => bytes32) public configHashOf;

    function register(address vault, bytes32 configHash) external {
        if (vault == address(0)) revert ZeroVault();
        if (RunnerVault(payable(vault)).owner() != msg.sender) revert NotVaultOwner();
        vaultOf[msg.sender] = vault;
        configHashOf[msg.sender] = configHash;
        emit Registered(msg.sender, vault, configHash);
    }
}
