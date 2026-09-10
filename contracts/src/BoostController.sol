// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {RunnerVault} from "./RunnerVault.sol";

/// @notice Deploys a new user-owned RunnerVault that mirrors a leader's
/// config hash. Relayer pays CREATE; booster owns the vault and funds it.
/// Never touches the leader's collateral or operator slot.
contract BoostController {
    error NotRelayer();
    error ZeroAddress();
    error BoostSelf();
    error InvalidLeader();

    event Boosted(
        address indexed leaderVault,
        address indexed newVault,
        address indexed owner,
        bytes32 configHash,
        uint256 budget
    );

    address public immutable relayer;
    address public immutable collateral;
    address public immutable module;
    address public immutable oracleHub;
    uint8 public immutable priceDecimals;

    mapping(address => address) public leaderOf;
    mapping(address => uint256) public boostCountOf;
    mapping(address => address[]) private _childrenOf;

    constructor(
        address relayer_,
        address collateral_,
        address module_,
        address oracleHub_,
        uint8 priceDecimals_
    ) {
        if (
            relayer_ == address(0) || collateral_ == address(0) || module_ == address(0)
                || oracleHub_ == address(0)
        ) {
            revert ZeroAddress();
        }
        relayer = relayer_;
        collateral = collateral_;
        module = module_;
        oracleHub = oracleHub_;
        priceDecimals = priceDecimals_;
    }

    function boost(
        address leaderVault,
        address owner_,
        bytes32 configHash,
        uint256 budget_,
        uint256 perWindowCap_,
        uint256 maxDailyLoss_,
        uint256 maxOutstanding_
    ) external returns (address vault) {
        if (msg.sender != relayer) revert NotRelayer();
        if (leaderVault == address(0) || owner_ == address(0)) revert ZeroAddress();
        if (leaderVault.code.length == 0) revert InvalidLeader();
        address leaderOwner = RunnerVault(payable(leaderVault)).owner();
        if (leaderOwner == address(0)) revert InvalidLeader();
        if (leaderOwner == owner_) revert BoostSelf();

        vault = address(
            new RunnerVault(
                owner_,
                collateral,
                module,
                oracleHub,
                priceDecimals,
                budget_,
                perWindowCap_,
                maxDailyLoss_,
                maxOutstanding_
            )
        );
        leaderOf[vault] = leaderVault;
        _childrenOf[leaderVault].push(vault);
        boostCountOf[leaderVault] += 1;
        emit Boosted(leaderVault, vault, owner_, configHash, budget_);
    }

    function childrenOf(address leaderVault) external view returns (address[] memory) {
        return _childrenOf[leaderVault];
    }
}
