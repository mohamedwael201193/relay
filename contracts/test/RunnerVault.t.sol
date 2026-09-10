// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {RunnerVault} from "../src/RunnerVault.sol";
import {RelayRegistry} from "../src/RelayRegistry.sol";
import {Verified} from "../src/Verified.sol";
import {MockModule, MockPool, MockMarket, MockERC20} from "./mocks/Mocks.sol";

contract RunnerVaultTest is Test {
    RunnerVault vault;
    MockModule module;
    MockPool pool;
    MockMarket market;
    MockERC20 usdc;
    RelayRegistry registry;

    address owner = address(this);
    address operator = address(0xBEEF);
    address stranger = address(0xBAD);
    address constant PRECOMPILE = address(0x0100);
    address constant HUB = 0xe40db387cC98601Dd11bd634fF2f3AD5686dE32b;

    bytes32 constant MARKET = keccak256("m1");

    function setUp() public {
        module = new MockModule();
        pool = new MockPool();
        market = new MockMarket();
        usdc = new MockERC20();
        module.set(MARKET, 42, address(pool), address(market), address(usdc), 7);
        vault = new RunnerVault(
            owner, address(usdc), address(module), HUB, 6, 10_000e6, 1_000e6, 5_000e6, 5_000e6
        );
        vault.setOperatorNow(operator);
        registry = new RelayRegistry();
        usdc.mint(owner, 100_000e6);
        usdc.approve(address(vault), type(uint256).max);
        vault.deposit(50_000e6);
    }

    function _topics(uint256 q, bytes32 m) internal pure returns (bytes32[] memory t) {
        t = new bytes32[](3);
        t[0] = Verified.ANSWER_DELIVERED_TOPIC0;
        t[1] = bytes32(q);
        t[2] = m;
    }

    function _up() internal pure returns (bytes memory) {
        uint256[] memory n = new uint256[](2);
        n[0] = 1;
        n[1] = 0;
        return abi.encode(uint32(1), n, false);
    }

    function _down() internal pure returns (bytes memory) {
        uint256[] memory n = new uint256[](2);
        n[0] = 0;
        n[1] = 1;
        return abi.encode(uint32(1), n, false);
    }

    function _void() internal pure returns (bytes memory) {
        uint256[] memory n = new uint256[](2);
        n[0] = 1;
        n[1] = 1;
        return abi.encode(uint32(2), n, true);
    }

    function _arm(uint8 kind, uint256 price, uint256 qty) internal {
        vm.prank(operator);
        vault.arm(MARKET, kind, price, qty, uint64((block.timestamp + 3600) * 1e9), 3);
    }

    function test_deposit_withdraw() public {
        assertEq(usdc.balanceOf(address(vault)), 50_000e6);
        vault.withdraw(1_000e6);
        assertEq(usdc.balanceOf(address(vault)), 49_000e6);
    }

    function test_stranger_cannot_withdraw() public {
        vm.prank(stranger);
        vm.expectRevert(RunnerVault.NotOwner.selector);
        vault.withdraw(1);
    }

    function test_operator_cannot_withdraw() public {
        vm.prank(operator);
        vm.expectRevert(RunnerVault.NotOwner.selector);
        vault.withdraw(1);
    }

    function test_stranger_cannot_kill() public {
        vm.prank(stranger);
        vm.expectRevert(RunnerVault.NotOwner.selector);
        vault.kill();
    }

    function test_operator_cannot_kill() public {
        vm.prank(operator);
        vm.expectRevert(RunnerVault.NotOwner.selector);
        vault.kill();
    }

    function test_stranger_cannot_set_caps() public {
        vm.prank(stranger);
        vm.expectRevert(RunnerVault.NotOwner.selector);
        vault.setCaps(1, 1, 1, 1);
    }

    function test_kill_blocks_operator_place_but_owner_withdraws() public {
        vault.kill();
        vm.prank(operator);
        vm.expectRevert(RunnerVault.Killed.selector);
        vault.arm(MARKET, 0, 500_000, 1_000_000, uint64((block.timestamp + 3600) * 1e9), 3);
        vault.withdraw(100e6);
        assertEq(usdc.balanceOf(address(vault)), 50_000e6 - 100e6);
    }

    function test_pause_blocks_operator_not_withdraw() public {
        vault.setTradingPaused(true);
        vm.prank(operator);
        vm.expectRevert(RunnerVault.TradingPaused.selector);
        vault.arm(MARKET, 0, 500_000, 1_000_000, uint64((block.timestamp + 3600) * 1e9), 3);
        vault.withdraw(1e6);
    }

    function test_window_cap() public {
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(RunnerVault.CapExceeded.selector, 2_000e6, 1_000e6));
        vault.arm(MARKET, 0, 1_000_000, 2_000e6, uint64((block.timestamp + 3600) * 1e9), 3);
    }

    function test_place_and_callback_idempotent() public {
        _arm(0, 500_000, 1_000_000); // cost = 500000*1e6/1e6 = 500000
        vm.prank(operator);
        (bool ok, uint128 id) = vault.placeArmed();
        assertTrue(ok);
        assertEq(id, 1);
        assertEq(pool.calls(), 1);

        vm.prank(PRECOMPILE);
        vault.onEvent(HUB, _topics(42, MARKET), _up());
        vm.prank(PRECOMPILE);
        vault.onEvent(HUB, _topics(42, MARKET), _up());
        assertEq(pool.calls(), 1);
    }

    function test_callback_spoof_reverts() public {
        _arm(0, 500_000, 1_000_000);
        vm.prank(stranger);
        vm.expectRevert();
        vault.onEvent(HUB, _topics(42, MARKET), _up());
    }

    function test_wrong_emitter_reverts() public {
        _arm(0, 500_000, 1_000_000);
        vm.prank(PRECOMPILE);
        vm.expectRevert(abi.encodeWithSelector(RunnerVault.UnexpectedEmitter.selector, address(this)));
        vault.onEvent(address(this), _topics(42, MARKET), _up());
    }

    function test_pool_recycle_nonce_mismatch() public {
        _arm(0, 500_000, 1_000_000);
        module.set(MARKET, 42, address(pool), address(market), address(usdc), 99);
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(RunnerVault.NonceMismatch.selector, 7, 99));
        vault.placeArmed();
    }

    function test_sync_resolution_without_callback() public {
        _arm(0, 500_000, 1_000_000);
        vm.prank(operator);
        vault.placeArmed();
        market.set(true, false, 0, 1);
        vault.syncResolution(MARKET);
        vault.redeemPosition(MARKET, 1, 1);
        assertEq(module.redeemCalls(), 1);
    }

    function test_registry_requires_owner() public {
        registry.register(address(vault), keccak256("cfg"));
        assertEq(registry.vaultOf(owner), address(vault));
        vm.prank(stranger);
        vm.expectRevert(RelayRegistry.NotVaultOwner.selector);
        registry.register(address(vault), keccak256("x"));
    }

    function test_18_decimal_cost() public {
        RunnerVault v18 = new RunnerVault(
            owner, address(usdc), address(module), HUB, 18, 10 ether, 1 ether, 5 ether, 5 ether
        );
        assertEq(v18.costOf(5e17, 2 ether), 1 ether);
    }

    function test_operator_delay() public {
        vault.proposeOperator(stranger);
        vm.expectRevert(RunnerVault.OperatorLocked.selector);
        vault.acceptOperator();
        vm.warp(block.timestamp + 48 hours);
        vault.acceptOperator();
        assertEq(vault.operator(), stranger);
    }

    function testFuzz_cost(uint128 price, uint128 qty) public view {
        uint256 p = bound(price, 1, 1_000_000);
        uint256 q = bound(qty, 1, 1_000e6);
        uint256 c = vault.costOf(p, q);
        assertEq(c, (p * q + 1e6 - 1) / 1e6);
    }

    function test_cost_ceils_partial_units() public view {
        assertEq(vault.costOf(1, 1), 1);
        assertEq(vault.collateralCost(2, 250_000, 1_000_000), 750_000);
    }

    function test_unsupported_sell_kind() public {
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(RunnerVault.UnsupportedKind.selector, 1));
        vault.arm(MARKET, 1, 500_000, 1_000_000, uint64((block.timestamp + 3600) * 1e9), 3);
    }

    function test_onEvent_does_not_place_next_order() public {
        _arm(0, 500_000, 1_000_000);
        vm.prank(operator);
        vault.placeArmed();
        uint256 before = pool.calls();
        vm.prank(PRECOMPILE);
        vault.onEvent(HUB, _topics(42, MARKET), _up());
        assertEq(pool.calls(), before);
    }

    function test_kill_clears_operator() public {
        vault.kill();
        assertEq(vault.operator(), address(0));
        assertTrue(vault.killed());
    }

    function test_buy_no_arm() public {
        vm.prank(operator);
        vault.arm(MARKET, 2, 250_000, 1_000_000, uint64((block.timestamp + 3600) * 1e9), 3);
        assertEq(vault.collateralCost(2, 250_000, 1_000_000), 750_000);
    }
}
