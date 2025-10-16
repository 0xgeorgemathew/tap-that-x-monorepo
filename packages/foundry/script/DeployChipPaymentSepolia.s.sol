// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import { MockUSDC } from "../contracts/MockUSDC.sol";
import { ChipRegistry } from "../contracts/ChipRegistry.sol";
import { USDCPaymentProcessor } from "../contracts/USDCPaymentProcessor.sol";

/**
 * @notice Deploy script for Chip Payment system on Sepolia testnet
 * @dev Options:
 *      1. Deploy MockUSDC (for testing): Set DEPLOY_MOCK_USDC=true
 *      2. Use real Sepolia USDC: Set SEPOLIA_USDC_ADDRESS in .env
 *
 * Usage:
 *   yarn deploy --file DeployChipPaymentSepolia.s.sol --network sepolia
 *
 * Prerequisites:
 *   - Generate/import keystore: yarn account:generate
 *   - Fund deployer with Sepolia ETH: https://sepoliafaucet.com
 *   - Set ALCHEMY_API_KEY and ETHERSCAN_API_KEY in .env
 */
contract DeployChipPaymentSepolia is ScaffoldETHDeploy {
    function run() external ScaffoldEthDeployerRunner {
        address usdcAddress;

        // Check if we should deploy MockUSDC or use existing Sepolia USDC
        string memory sepoliaUsdc = vm.envOr("SEPOLIA_USDC_ADDRESS", string(""));
        bool deployMockUsdc = bytes(sepoliaUsdc).length == 0;

        if (deployMockUsdc) {
            console.log("Deploying MockUSDC for testing...");
            MockUSDC mockUSDC = new MockUSDC();
            usdcAddress = address(mockUSDC);
            console.log("MockUSDC deployed at:", usdcAddress);
        } else {
            usdcAddress = vm.parseAddress(sepoliaUsdc);
            console.log("Using existing Sepolia USDC at:", usdcAddress);
            console.log("WARNING: Ensure this USDC contract supports EIP-2612 permit!");
        }

        // Deploy ChipRegistry
        ChipRegistry chipRegistry = new ChipRegistry();
        console.log("ChipRegistry deployed at:", address(chipRegistry));

        // Deploy USDCPaymentProcessor
        USDCPaymentProcessor paymentProcessor = new USDCPaymentProcessor(usdcAddress, address(chipRegistry));
        console.log("USDCPaymentProcessor deployed at:", address(paymentProcessor));

        console.log("\n=== Deployment Summary ===");
        console.log("Network: Sepolia");
        console.log("USDC Address:", usdcAddress);
        console.log("ChipRegistry:", address(chipRegistry));
        console.log("USDCPaymentProcessor:", address(paymentProcessor));
        console.log("\nNext steps:");
        console.log("1. Verify contracts: yarn verify --network sepolia");
        console.log("2. Update frontend scaffold.config.ts to use chains.sepolia");
        console.log("3. Fund relayer account with Sepolia ETH");
        if (deployMockUsdc) {
            console.log("4. Mint test USDC: cast send", usdcAddress, "\"faucet(address)\" <YOUR_ADDRESS> --rpc-url sepolia");
        }
    }
}
