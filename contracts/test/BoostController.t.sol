// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {BoostController} from "../src/BoostController.sol";
import {RunnerVault} from "../src/RunnerVault.sol";
import {MockModule, MockPool, MockMarket, MockERC20, Mock6909} from "./mocks/Mocks.sol";

contract BoostControllerTest is Test {
    BoostController controller;
    RunnerVault leader;
    MockModule module;
    MockERC20 usdc;

    address relayer = address(this);
    address leaderOwner = address(0xA11CE);
    address booster = address(0xB00);
    address stranger = address(0xBAD);
    address constant HUB = 0xe40db387cC98601Dd11bd634fF2f3AD5686dE32b;

    function setUp() public {
        module = new MockModule();
        usdc = new MockERC20();
        leader = new RunnerVault(
            leaderOwner, address(usdc), address(module), HUB, 6, 100e6, 100e6, 30e6, 100e6
        );
        controller = new BoostController(relayer, address(usdc), address(module), HUB, 6);
    }

    function test_boost_deploys_owned_vault_and_never_leader_wallet() public {
        bytes32 cfg = keccak256("FOLLOW:900");
        address vault = controller.boost(address(leader), booster, cfg, 25e6, 25e6, 10e6, 25e6);
        assertEq(RunnerVault(payable(vault)).owner(), booster);
        assertTrue(RunnerVault(payable(vault)).owner() != leaderOwner);
        assertEq(controller.leaderOf(vault), address(leader));
        assertEq(controller.boostCountOf(address(leader)), 1);
        address[] memory kids = controller.childrenOf(address(leader));
        assertEq(kids.length, 1);
        assertEq(kids[0], vault);
        assertEq(usdc.balanceOf(address(leader)), 0);
    }

    function test_boost_rejects_self_and_stranger() public {
        vm.expectRevert(BoostController.BoostSelf.selector);
        controller.boost(address(leader), leaderOwner, bytes32(0), 25e6, 25e6, 10e6, 25e6);
        vm.prank(stranger);
        vm.expectRevert(BoostController.NotRelayer.selector);
        controller.boost(address(leader), booster, bytes32(0), 25e6, 25e6, 10e6, 25e6);
    }

    function test_boost_rejects_eoa_leader() public {
        vm.expectRevert(BoostController.InvalidLeader.selector);
        controller.boost(address(0x1234), booster, bytes32(0), 25e6, 25e6, 10e6, 25e6);
    }
}
