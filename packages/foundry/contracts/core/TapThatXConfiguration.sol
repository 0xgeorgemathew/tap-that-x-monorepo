// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./TapThatXRegistry.sol";

/// @title TapThatXConfiguration
/// @notice Stores action configurations for chip-authorized executions
/// @dev Maps (owner, chip) to pre-configured contract calls
contract TapThatXConfiguration {
    TapThatXRegistry public immutable registry;

    struct ActionConfig {
        address targetContract;
        bytes staticCallData;
        uint256 value;
        string description;
        bool isActive;
    }

    mapping(address => mapping(address => ActionConfig)) public configurations;

    event ConfigurationSet(
        address indexed owner, address indexed chip, address indexed target, string description
    );
    event ConfigurationToggled(address indexed owner, address indexed chip, bool isActive);
    event ConfigurationRemoved(address indexed owner, address indexed chip);

    constructor(address _registry) {
        require(_registry != address(0), "Invalid registry address");
        registry = TapThatXRegistry(_registry);
    }

    /// @notice Set or update a chip's action configuration
    /// @param chip The chip address to configure
    /// @param targetContract The contract address to call on tap
    /// @param staticCallData Pre-encoded function call data
    /// @param value ETH value to send with the call
    /// @param description Human-readable description of the action
    function setConfiguration(
        address chip,
        address targetContract,
        bytes calldata staticCallData,
        uint256 value,
        string calldata description
    ) external {
        require(chip != address(0), "Invalid chip address");
        require(targetContract != address(0), "Invalid target contract");
        require(staticCallData.length > 0, "Empty callData");
        require(registry.hasChip(msg.sender, chip), "Not chip owner");

        configurations[msg.sender][chip] = ActionConfig({
            targetContract: targetContract,
            staticCallData: staticCallData,
            value: value,
            description: description,
            isActive: true
        });

        emit ConfigurationSet(msg.sender, chip, targetContract, description);
    }

    /// @notice Toggle a configuration active/inactive
    /// @param chip The chip address
    function toggleConfiguration(address chip) external {
        require(registry.hasChip(msg.sender, chip), "Not chip owner");
        require(configurations[msg.sender][chip].targetContract != address(0), "No configuration exists");

        configurations[msg.sender][chip].isActive = !configurations[msg.sender][chip].isActive;

        emit ConfigurationToggled(msg.sender, chip, configurations[msg.sender][chip].isActive);
    }

    /// @notice Remove a configuration
    /// @param chip The chip address
    function removeConfiguration(address chip) external {
        require(registry.hasChip(msg.sender, chip), "Not chip owner");
        require(configurations[msg.sender][chip].targetContract != address(0), "No configuration exists");

        delete configurations[msg.sender][chip];

        emit ConfigurationRemoved(msg.sender, chip);
    }

    /// @notice Get a chip's configuration
    /// @param owner The chip owner address
    /// @param chip The chip address
    /// @return ActionConfig The configuration
    function getConfiguration(address owner, address chip) external view returns (ActionConfig memory) {
        return configurations[owner][chip];
    }

    /// @notice Check if a configuration exists and is active
    /// @param owner The chip owner address
    /// @param chip The chip address
    /// @return bool True if configuration exists and is active
    function isConfigured(address owner, address chip) external view returns (bool) {
        ActionConfig storage config = configurations[owner][chip];
        return config.targetContract != address(0) && config.isActive;
    }
}
