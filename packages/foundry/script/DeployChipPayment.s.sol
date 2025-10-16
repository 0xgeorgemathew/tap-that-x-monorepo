// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import { MockUSDC } from "../contracts/MockUSDC.sol";
import { ChipRegistry } from "../contracts/ChipRegistry.sol";
import { USDCPaymentProcessor } from "../contracts/USDCPaymentProcessor.sol";

/**
 * @notice Deploy script for Chip Payment system contracts
 * @dev Inherits ScaffoldETHDeploy which:
 *      - Includes forge-std/Script.sol for deployment
 *      - Includes ScaffoldEthDeployerRunner modifier
 *      - Provides `deployer` variable
 * Example:
 * yarn deploy --file DeployChipPayment.s.sol  # local anvil chain
 * yarn deploy --file DeployChipPayment.s.sol --network sepolia # live network (requires keystore)
 */
contract DeployChipPayment is ScaffoldETHDeploy {
    /**
     * @dev Deployer setup based on `ETH_KEYSTORE_ACCOUNT` in `.env`:
     *      - "scaffold-eth-default": Uses Anvil's account #9 (0xa0Ee7A142d267C1f36714E4a8F75612F20a79720), no password prompt
     *      - "scaffold-eth-custom": requires password used while creating keystore
     *
     * Note: Must use ScaffoldEthDeployerRunner modifier to:
     *      - Setup correct `deployer` account and fund it
     *      - Export contract addresses & ABIs to `nextjs` packages
     */
    function run() external ScaffoldEthDeployerRunner {
        // Deploy MockUSDC
        MockUSDC mockUSDC = new MockUSDC();
        console.log("MockUSDC deployed at:", address(mockUSDC));

        // Deploy ChipRegistry
        ChipRegistry chipRegistry = new ChipRegistry();
        console.log("ChipRegistry deployed at:", address(chipRegistry));

        // Deploy USDCPaymentProcessor
        new USDCPaymentProcessor(address(mockUSDC), address(chipRegistry));
    }
}
