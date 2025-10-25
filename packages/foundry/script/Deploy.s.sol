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

/**
 * @notice Universal deploy script for Tap That X Protocol - works on all chains
 * @dev Automatically selects real USDC on production chains or deploys MockUSDC on testnets
 *
 * Deploys:
 *   1. TapThatXRegistry - Chip registration and ownership
 *   2. TapThatXProtocol - Generic chip-authorized execution engine
 *   3. TapThatXConfiguration - Store action configurations per chip
 *   4. TapThatXExecutor - Execute pre-configured tap actions
 *   5. MockUSDC - Test USDC (testnets only, uses real USDC on mainnet)
 *   6. USDCTapPayment - Example USDC payment implementation
 *   7. TapThatXAaveRebalancer - Aave position rebalancer (Base Sepolia only)
 *   8. TapThatXAavePositionCloser - Aave position closer (Base Sepolia only)
 *
 * Usage:
 *   yarn deploy                    # localhost (deploys MockUSDC)
 *   yarn deploy --network sepolia  # Sepolia testnet (deploys MockUSDC)
 *   yarn deploy --network base     # Base mainnet (uses real USDC)
 */
contract Deploy is ScaffoldETHDeploy {
    // Production USDC addresses for mainnet chains


    function run() external ScaffoldEthDeployerRunner {

       

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
