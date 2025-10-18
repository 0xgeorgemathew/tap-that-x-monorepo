// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import { MockUSDC } from "../contracts/MockUSDC.sol";
import { TapThatXRegistry } from "../contracts/core/TapThatXRegistry.sol";
import { TapThatXProtocol } from "../contracts/core/TapThatXProtocol.sol";
import { USDCTapPayment } from "../contracts/examples/USDCTapPayment.sol";

/**
 * @notice Universal deploy script for Tap That X Protocol - works on all chains
 * @dev Automatically selects real USDC on production chains or deploys MockUSDC on testnets
 *
 * Deploys:
 *   1. TapThatXRegistry - Chip registration and ownership
 *   2. TapThatXProtocol - Generic chip-authorized execution engine
 *   3. MockUSDC - Test USDC (testnets only, uses real USDC on mainnet)
 *   4. USDCTapPayment - Example USDC payment implementation
 *
 * Usage:
 *   yarn deploy                    # localhost (deploys MockUSDC)
 *   yarn deploy --network sepolia  # Sepolia testnet (deploys MockUSDC)
 *   yarn deploy --network base     # Base mainnet (uses real USDC)
 */
contract Deploy is ScaffoldETHDeploy {
    // Production USDC addresses for mainnet chains
    function getUSDCAddress(uint256 chainId) internal pure returns (address) {
        // Ethereum Mainnet
        if (chainId == 1) return 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
        // Base
        if (chainId == 8453) return 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
        // Arbitrum One
        if (chainId == 42161) return 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;
        // Optimism
        if (chainId == 10) return 0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85;
        // Polygon
        if (chainId == 137) return 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359;

        return address(0); // Signal to deploy MockUSDC
    }

    function run() external ScaffoldEthDeployerRunner {
        address usdcAddress = getUSDCAddress(block.chainid);

        // Deploy MockUSDC for testnets/localhost, use real USDC for production
        if (usdcAddress == address(0)) {
            console.log("Deploying MockUSDC for testing...");
            MockUSDC mockUSDC = new MockUSDC();
            usdcAddress = address(mockUSDC);
            console.log("MockUSDC deployed at:", usdcAddress);

            // Register deployment for frontend
            deployments.push(Deployment({ name: "MockUSDC", addr: usdcAddress }));
        } else {
            console.log("Using production USDC at:", usdcAddress);
        }

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

        // Deploy USDCTapPayment
        USDCTapPayment payment = new USDCTapPayment(usdcAddress, address(protocol), address(registry));
        console.log("USDCTapPayment deployed at:", address(payment));

        // Register deployment for frontend
        deployments.push(Deployment({ name: "USDCTapPayment", addr: address(payment) }));

        console.log("\n=== Tap That X Protocol Deployed ===");
        console.log("Chain ID:", block.chainid);
        console.log("USDC Address:", usdcAddress);
        console.log("TapThatXRegistry:", address(registry));
        console.log("TapThatXProtocol:", address(protocol));
        console.log("USDCTapPayment:", address(payment));
        console.log("\nNext: yarn verify --network <network>");
    }
}
