//SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import { DeployChipPayment } from "./DeployChipPayment.s.sol";

/**
 * @notice Main deployment script - works on all chains
 * @dev Automatically detects chain and deploys appropriate contracts
 *
 * Usage:
 *   yarn deploy                         # localhost
 *   yarn deploy --network sepolia       # Sepolia testnet
 *   yarn deploy --network base          # Base mainnet
 *   yarn deploy --network arbitrum      # Arbitrum mainnet
 *   yarn deploy --network optimism      # Optimism mainnet
 */
contract DeployScript is ScaffoldETHDeploy {
    function run() external {
        // Deploy Chip Payment System (works on all chains)
        DeployChipPayment deployChipPayment = new DeployChipPayment();
        deployChipPayment.run();
    }
}
