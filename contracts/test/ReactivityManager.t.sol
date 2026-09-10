// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {ReactivityManager} from "../src/ReactivityManager.sol";
import {RunnerVault} from "../src/RunnerVault.sol";
import {MockModule, MockPool, MockMarket, MockERC20} from "./mocks/Mocks.sol";

contract ReactivityManagerTest is Test {
    RunnerVault vault;
    MockModule module;
    MockPool pool;
    MockMarket market;
    MockERC20 usdc;
    ReactivityManager manager;

    address operator = address(0xBEEF);
    address stranger = address(0xBAD);
    address constant HUB = 0xe40db387cC98601Dd11bd634fF2f3AD5686dE32b;
    bytes32 constant MARKET = keccak256("m1");

    function setUp() public {
        module = new MockModule();
        pool = new MockPool();
        market = new MockMarket();
        usdc = new MockERC20();
        module.set(MARKET, 42, address(pool), address(market), address(usdc), 7);
        vault = new RunnerVault(address(this), address(usdc), address(module), HUB, 6, 10_000e6, 1_000e6, 5_000e6, 5_000e6);
        vault.setOperatorNow(operator);
        manager = new ReactivityManager(operator, HUB);
    }

    function test_register_reverts_without_stake() public {
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(ReactivityManager.StakeTooLow.selector, 0, 32 ether));
        manager.register(address(vault), MARKET);
    }

    function test_stranger_cannot_register() public {
        vm.deal(address(manager), 33 ether);
        vm.prank(stranger);
        vm.expectRevert(ReactivityManager.NotVaultOwner.selector);
        manager.register(address(vault), MARKET);
    }

    function test_vault_owner_hits_precompile_without_somnia_fork() public {
        vm.deal(address(manager), 33 ether);
        vm.expectRevert();
        manager.register(address(vault), MARKET);
    }
}
