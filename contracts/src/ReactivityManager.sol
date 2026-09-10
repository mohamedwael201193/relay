// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {SomniaExtensions} from "@somnia-chain/reactivity-contracts/contracts/interfaces/SomniaExtensions.sol";
import {Verified} from "./Verified.sol";
import {RunnerVault} from "./RunnerVault.sol";

/// @notice Shared-stake subscription owner. Handler remains the user vault.
contract ReactivityManager {
    error NotOperator();
    error NotVaultOwner();
    error StakeTooLow(uint256 balance, uint256 minimum);
    error AlreadyRegistered();
    error NotRegistered();

    address public immutable operator;
    address public immutable oracleHub;
    mapping(bytes32 => uint256) public subscriptionOf;

    event Registered(address indexed vault, bytes32 indexed marketId, uint256 subscriptionId);
    event Unregistered(address indexed vault, bytes32 indexed marketId, uint256 subscriptionId);
    event Funded(address indexed from, uint256 amount);

    constructor(address operator_, address oracleHub_) payable {
        operator = operator_ == address(0) ? msg.sender : operator_;
        oracleHub = oracleHub_;
    }

    receive() external payable {
        emit Funded(msg.sender, msg.value);
    }

    function _key(address vault, bytes32 marketId) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(vault, marketId));
    }

    function register(address vault, bytes32 marketId) external returns (uint256 subscriptionId) {
        if (msg.sender != operator && msg.sender != RunnerVault(payable(vault)).owner()) revert NotVaultOwner();
        bytes32 k = _key(vault, marketId);
        if (subscriptionOf[k] != 0) revert AlreadyRegistered();
        uint256 minimum = SomniaExtensions.SUBSCRIPTION_OWNER_MINIMUM_BALANCE;
        if (address(this).balance < minimum) revert StakeTooLow(address(this).balance, minimum);

        bytes32[4] memory topics;
        topics[0] = Verified.ANSWER_DELIVERED_TOPIC0;
        topics[2] = marketId;

        subscriptionId = SomniaExtensions.subscribe(
            vault,
            SomniaExtensions.SubscriptionFilter({ eventTopics: topics, origin: address(0), emitter: oracleHub }),
            SomniaExtensions.SubscriptionOptions({
                priorityFeePerGas: 1 gwei,
                maxFeePerGas: 40 gwei,
                gasLimit: 10_000_000
            })
        );
        subscriptionOf[k] = subscriptionId;
        emit Registered(vault, marketId, subscriptionId);
    }

    function unregister(address vault, bytes32 marketId) external {
        if (msg.sender != operator && msg.sender != RunnerVault(payable(vault)).owner()) revert NotVaultOwner();
        bytes32 k = _key(vault, marketId);
        uint256 id = subscriptionOf[k];
        if (id == 0) revert NotRegistered();
        SomniaExtensions.unsubscribe(id);
        delete subscriptionOf[k];
        emit Unregistered(vault, marketId, id);
    }
}
