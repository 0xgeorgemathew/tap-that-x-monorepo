// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import { TapThatXBridgeETHViaWETH } from "../contracts/extensions/TapThatXBridgeETHViaWETH.sol";
import { IWETH } from "../contracts/interfaces/IWETH.sol";
import { IL1StandardBridge } from "../contracts/interfaces/IL1StandardBridge.sol";
import { TapThatXProtocol } from "../contracts/core/TapThatXProtocol.sol";
import { TapThatXRegistry } from "../contracts/core/TapThatXRegistry.sol";

contract TapThatXBridgeETHViaWETHTest is Test {
    TapThatXBridgeETHViaWETH public bridgeExtension;
    TapThatXProtocol public protocol;
    TapThatXRegistry public registry;

    address constant WETH_SEPOLIA = 0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9;
    address constant BRIDGE_OP_SEPOLIA = 0xFBb0621E0B23b5478B630BD55a5f21f67730B0F1;
    address constant BRIDGE_BASE_SEPOLIA = 0xfd0Bf71F60660E2f608ed56e1659C450eB113120;

    address user = vm.addr(1);
    address recipient = vm.addr(2);

    function setUp() public {
        // Fork Sepolia for testing with real WETH and bridges
        vm.createSelectFork(vm.envString("SEPOLIA_RPC_URL"));

        registry = new TapThatXRegistry();
        protocol = new TapThatXProtocol(address(registry));
        bridgeExtension = new TapThatXBridgeETHViaWETH(
            WETH_SEPOLIA,
            BRIDGE_OP_SEPOLIA,
            BRIDGE_BASE_SEPOLIA,
            address(protocol)
        );
    }

    function testUnwrapAndBridgeDual() public {
        uint256 amount = 0.01 ether;

        // User wraps ETH to WETH
        vm.deal(user, 1 ether);
        vm.prank(user);
        IWETH(WETH_SEPOLIA).deposit{ value: amount }();

        // Verify WETH balance
        assertEq(IWETH(WETH_SEPOLIA).balanceOf(user), amount);

        // User approves extension
        vm.prank(user);
        IWETH(WETH_SEPOLIA).approve(address(bridgeExtension), type(uint256).max);

        // Protocol calls unwrapAndBridgeDual (50/50 split)
        vm.prank(address(protocol));
        bridgeExtension.unwrapAndBridgeDual(user, recipient, amount, 200000, 200000);

        // Verify WETH was pulled from user
        assertEq(IWETH(WETH_SEPOLIA).balanceOf(user), 0);

        // Note: Actual bridge verification requires L2 state check
        // which is not available in a fork test
    }

    function testOnlyProtocolCanCall() public {
        vm.expectRevert("Only protocol can call");
        bridgeExtension.unwrapAndBridgeDual(user, recipient, 0.01 ether, 200000, 200000);
    }

    function testRevertInvalidOwner() public {
        vm.prank(address(protocol));
        vm.expectRevert("Invalid owner");
        bridgeExtension.unwrapAndBridgeDual(address(0), recipient, 0.01 ether, 200000, 200000);
    }

    function testRevertInvalidRecipient() public {
        vm.prank(address(protocol));
        vm.expectRevert("Invalid recipient");
        bridgeExtension.unwrapAndBridgeDual(user, address(0), 0.01 ether, 200000, 200000);
    }

    function testRevertZeroAmount() public {
        vm.prank(address(protocol));
        vm.expectRevert("Amount must be > 0");
        bridgeExtension.unwrapAndBridgeDual(user, recipient, 0, 200000, 200000);
    }

    function testRevertOddAmount() public {
        vm.prank(address(protocol));
        vm.expectRevert("Amount must be even for 50/50 split");
        bridgeExtension.unwrapAndBridgeDual(user, recipient, 0.001 ether, 200000, 200000);
    }

    function testRevertWETHTransferFails() public {
        uint256 amount = 0.01 ether;

        // User wraps ETH but doesn't approve
        vm.deal(user, 1 ether);
        vm.prank(user);
        IWETH(WETH_SEPOLIA).deposit{ value: amount }();

        // Protocol calls without approval
        vm.prank(address(protocol));
        vm.expectRevert("WETH transfer failed");
        bridgeExtension.unwrapAndBridgeDual(user, recipient, amount, 200000, 200000);
    }

    function testReceiveOnlyFromWETH() public {
        // Try sending ETH directly (should revert)
        vm.deal(address(this), 1 ether);
        (bool success,) = address(bridgeExtension).call{ value: 0.1 ether }("");
        assertFalse(success);
    }

    function testEvent() public {
        uint256 amount = 0.01 ether;

        // Setup
        vm.deal(user, 1 ether);
        vm.prank(user);
        IWETH(WETH_SEPOLIA).deposit{ value: amount }();
        vm.prank(user);
        IWETH(WETH_SEPOLIA).approve(address(bridgeExtension), type(uint256).max);

        // Expect event
        vm.expectEmit(true, true, false, true);
        emit TapThatXBridgeETHViaWETH.ETHBridgedViaWETH(
            user,
            recipient,
            amount / 2,
            amount / 2,
            200000,
            200000
        );

        vm.prank(address(protocol));
        bridgeExtension.unwrapAndBridgeDual(user, recipient, amount, 200000, 200000);
    }
}
