// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import { MockUSDC } from "../contracts/MockUSDC.sol";
import { TapThatXRegistry } from "../contracts/core/TapThatXRegistry.sol";
import { TapThatXProtocol } from "../contracts/core/TapThatXProtocol.sol";
import { TapThatXConfiguration } from "../contracts/core/TapThatXConfiguration.sol";
import { TapThatXExecutor } from "../contracts/core/TapThatXExecutor.sol";
import { USDCTapPayment } from "../contracts/examples/USDCTapPayment.sol";
import { TapThatXAaveRebalancer } from "../contracts/extensions/TapThatXAaveRebalancer.sol";
import { TapThatXAavePositionCloser } from "../contracts/extensions/TapThatXAavePositionCloser.sol";
import { TapThatXBridgeETHViaWETH } from "../contracts/extensions/TapThatXBridgeETHViaWETH.sol";

/**
 * @notice Chain-specific deploy script for Tap That X Protocol
 * @dev Supports Sepolia (bridge testing) and Base Sepolia (full features)
 *
 * Sepolia (11155111) - Bridge Testing ONLY:
 *   1. TapThatXRegistry - Chip registration and ownership
 *   2. TapThatXProtocol - Generic chip-authorized execution engine
 *   3. TapThatXConfiguration - Store action configurations per chip
 *   4. TapThatXExecutor - Execute pre-configured tap actions
 *   5. TapThatXBridgeETHViaWETH - Bridge ETH via WETH to OP + Base Sepolia
 *
 * Base Sepolia (84532) - All Features (except bridge):
 *   1-4. Core contracts (same as above)
 *   5. MockUSDC - Test USDC for ERC20 transfers
 *   6. TapThatXAaveRebalancer - Aave position rebalancer
 *   7. TapThatXAavePositionCloser - Aave position closer
 *
 * Usage:
 *   forge script script/Deploy.s.sol --rpc-url sepolia --broadcast      # Sepolia (bridge only)
 *   forge script script/Deploy.s.sol --rpc-url base-sepolia --broadcast # Base Sepolia (full)
 */
contract Deploy is ScaffoldETHDeploy {
    // Production USDC addresses for mainnet chains


    function run() external ScaffoldEthDeployerRunner {
        // Only deploy on Sepolia (bridge testing) or Base Sepolia (full features)
        require(
            block.chainid == 11155111 || block.chainid == 84532,
            "Deploy: Only supported on Sepolia (11155111) or Base Sepolia (84532)"
        );

        // Deploy TapThatXRegistry
        TapThatXRegistry registry = new TapThatXRegistry();
        console.log("TapThatXRegistry deployed at:", address(registry));

        // Register deployment for frontend
        deployments.push(Deployment({ name: "TapThatXRegistry", addr: address(registry) }));

        // Deploy TapThatXProtocol
        TapThatXProtocol protocol = new TapThatXProtocol(address(registry));
        console.log("TapThatXProtocol deployed at:", address(protocol));

        // Register deployment for frontend
        deployments.push(Deployment({ name: "TapThatXProtocol", addr: address(protocol) }));

        // Deploy TapThatXConfiguration
        TapThatXConfiguration configuration = new TapThatXConfiguration(address(registry));
        console.log("TapThatXConfiguration deployed at:", address(configuration));

        // Register deployment for frontend
        deployments.push(Deployment({ name: "TapThatXConfiguration", addr: address(configuration) }));

        // Deploy TapThatXExecutor
        TapThatXExecutor executor = new TapThatXExecutor(address(protocol), address(configuration));
        console.log("TapThatXExecutor deployed at:", address(executor));

        // Register deployment for frontend
        deployments.push(Deployment({ name: "TapThatXExecutor", addr: address(executor) }));

        // Deploy TapThatXBridgeETHViaWETH (Sepolia only - for bridging to OP + Base)
        if (block.chainid == 11155111) {
            // Sepolia addresses for WETH and L1StandardBridges
            address WETH_SEPOLIA = 0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9;
            address BRIDGE_OP_SEPOLIA = 0xFBb0621E0B23b5478B630BD55a5f21f67730B0F1;
            address BRIDGE_BASE_SEPOLIA = 0xfd0Bf71F60660E2f608ed56e1659C450eB113120;

            TapThatXBridgeETHViaWETH bridgeExtension = new TapThatXBridgeETHViaWETH(
                WETH_SEPOLIA,
                BRIDGE_OP_SEPOLIA,
                BRIDGE_BASE_SEPOLIA,
                address(protocol)
            );

            console.log("TapThatXBridgeETHViaWETH deployed at:", address(bridgeExtension));
            deployments.push(Deployment({ name: "TapThatXBridgeETHViaWETH", addr: address(bridgeExtension) }));
        }

        // Deploy MockUSDC (Base Sepolia only - for ERC20 transfer testing)
        if (block.chainid == 84532) {
            MockUSDC usdc = new MockUSDC();
            console.log("MockUSDC deployed at:", address(usdc));
            deployments.push(Deployment({ name: "MockUSDC", addr: address(usdc) }));
        }

        // Deploy TapThatXAaveRebalancer (Base Sepolia only)
        if (block.chainid == 84532) {
            // Base Sepolia Aave V3 Pool address
            address aavePool = 0x8bAB6d1b75f19e9eD9fCe8b9BD338844fF79aE27;

            TapThatXAaveRebalancer rebalancer = new TapThatXAaveRebalancer(aavePool, address(protocol));
            console.log("TapThatXAaveRebalancer deployed at:", address(rebalancer));
            deployments.push(Deployment({ name: "TapThatXAaveRebalancer", addr: address(rebalancer) }));

            TapThatXAavePositionCloser closer = new TapThatXAavePositionCloser(aavePool, address(protocol));
            console.log("TapThatXAavePositionCloser deployed at:", address(closer));
            deployments.push(Deployment({ name: "TapThatXAavePositionCloser", addr: address(closer) }));
        }

        console.log("\n=== Tap That X Protocol Deployed ===");
        console.log("Chain ID:", block.chainid);
        console.log("TapThatXRegistry:", address(registry));
        console.log("TapThatXProtocol:", address(protocol));
        console.log("TapThatXConfiguration:", address(configuration));
        console.log("TapThatXExecutor:", address(executor));
        console.log("\nNext: yarn verify --network <network>");
    }
}
