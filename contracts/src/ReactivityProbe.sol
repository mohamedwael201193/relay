// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {SomniaEventHandler} from "@somnia-chain/reactivity-contracts/contracts/SomniaEventHandler.sol";
import {SomniaExtensions} from "@somnia-chain/reactivity-contracts/contracts/interfaces/SomniaExtensions.sol";

/// @notice Isolated Reactivity probe. Records callback facts; places no orders.
contract ReactivityProbe is SomniaEventHandler {
    error NotOwner();
    error AlreadySubscribed();
    error WithdrawFailed();

    address public immutable owner;
    uint256 public subscriptionId;
    uint256 public hits;
    address public lastEmitter;
    address public lastMsgSender;
    bytes32 public lastTopic0;
    uint64 public armedBlock;
    uint64 public lastBlock;

    event Armed(uint256 indexed subscriptionId, uint64 blockNumber);
    event Hit(address indexed sender, address indexed emitter, bytes32 topic0);

    constructor() {
        owner = msg.sender;
    }

    receive() external payable {}

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function subscribeNextBlock() external onlyOwner returns (uint256 id) {
        if (subscriptionId != 0) revert AlreadySubscribed();
        uint64 target = uint64(block.number + 3);
        armedBlock = target;
        id = SomniaExtensions.scheduleSubscriptionAtBlock(
            address(this),
            target,
            SomniaExtensions.defaultSubscriptionOptions()
        );
        subscriptionId = id;
        emit Armed(id, target);
    }

    function cancel() external onlyOwner {
        if (subscriptionId == 0) return;
        SomniaExtensions.unsubscribe(subscriptionId);
        subscriptionId = 0;
    }

    function withdrawNative(uint256 amount) external onlyOwner {
        (bool ok,) = payable(owner).call{value: amount}("");
        if (!ok) revert WithdrawFailed();
    }

    function _onEvent(address emitter, bytes32[] calldata eventTopics, bytes calldata) internal override {
        lastMsgSender = msg.sender;
        lastEmitter = emitter;
        lastTopic0 = eventTopics.length > 0 ? eventTopics[0] : bytes32(0);
        lastBlock = uint64(block.number);
        hits += 1;
        emit Hit(msg.sender, emitter, lastTopic0);
    }
}
