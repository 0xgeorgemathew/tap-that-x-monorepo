// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./TapThatXProtocol.sol";
import "./TapThatXConfiguration.sol";

/// @title TapThatXExecutor
/// @notice Simplified execution interface for pre-configured chip actions
/// @dev Fetches configuration and executes via TapThatXProtocol
contract TapThatXExecutor is ReentrancyGuard {
    TapThatXProtocol public immutable protocol;
    TapThatXConfiguration public immutable configuration;

    event TapExecuted(
        address indexed owner,
        address indexed chip,
        address indexed target,
        bytes32 nonce,
        bool success,
        string description
    );

    constructor(address _protocol, address _configuration) {
        require(_protocol != address(0), "Invalid protocol address");
        require(_configuration != address(0), "Invalid configuration address");

        protocol = TapThatXProtocol(payable(_protocol));
        configuration = TapThatXConfiguration(_configuration);
    }

    /// @notice Execute a pre-configured action by tapping a chip
    /// @param owner The chip owner address (payer/executor)
    /// @param chip The chip address being tapped
    /// @param chipSignature The chip's authorization signature
    /// @param timestamp When the authorization was created
    /// @param nonce Unique nonce for replay protection
    /// @return success Whether the execution succeeded
    /// @return returnData The return data from the call
    function executeTap(
        address owner,
        address chip,
        bytes memory chipSignature,
        uint256 timestamp,
        bytes32 nonce
    ) external payable nonReentrant returns (bool success, bytes memory returnData) {
        require(owner != address(0), "Invalid owner");
        require(chip != address(0), "Invalid chip");

        TapThatXConfiguration.ActionConfig memory config = configuration.getConfiguration(owner, chip);

        require(config.targetContract != address(0), "No configuration exists");
        require(config.isActive, "Configuration is inactive");
        require(msg.value >= config.value, "Insufficient ETH sent");

        (success, returnData) = protocol.executeAuthorizedCall{value: config.value}(
            owner,
            config.targetContract,
            config.staticCallData,
            config.value,
            chipSignature,
            timestamp,
            nonce
        );

        emit TapExecuted(owner, chip, config.targetContract, nonce, success, config.description);

        return (success, returnData);
    }

    /// @notice Preview what would be executed for a given owner/chip combination
    /// @param owner The chip owner address
    /// @param chip The chip address
    /// @return ActionConfig The configuration that would be executed
    function previewTap(address owner, address chip)
        external
        view
        returns (TapThatXConfiguration.ActionConfig memory)
    {
        return configuration.getConfiguration(owner, chip);
    }

    /// @notice Check if a tap can be executed
    /// @param owner The chip owner address
    /// @param chip The chip address
    /// @return bool True if configuration exists and is active
    function canExecute(address owner, address chip) external view returns (bool) {
        return configuration.isConfigured(owner, chip);
    }
}
