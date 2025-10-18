// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./TapThatXRegistry.sol";
import "./TapThatXAuth.sol";

/// @title TapThatXProtocol
/// @notice Core protocol for chip-authorized execution of arbitrary contract calls
/// @dev Enables "Tap to Pay" for any blockchain interaction - not just payments
contract TapThatXProtocol is EIP712, ReentrancyGuard {
    TapThatXRegistry public immutable registry;
    uint256 public constant MAX_TIMESTAMP_WINDOW = 300; // 5 minutes

    mapping(bytes32 => bool) public usedNonces;

    event AuthorizedCallExecuted(
        address indexed owner,
        address indexed chip,
        address indexed target,
        bytes callData,
        uint256 value,
        bytes32 nonce,
        bool success
    );

    event NonceUsed(bytes32 indexed nonce);

    constructor(address _registry) EIP712("TapThatXProtocol", "1") {
        require(_registry != address(0), "Invalid registry address");
        registry = TapThatXRegistry(_registry);
    }

    /// @notice Execute an arbitrary contract call authorized by a registered chip
    /// @param owner The chip owner address (must own the chip)
    /// @param target The contract address to call
    /// @param callData The encoded function call data
    /// @param value The amount of ETH to send with the call (0 for none)
    /// @param chipSignature The chip's EIP-712 signature authorizing this call
    /// @param timestamp When the authorization was created
    /// @param nonce Unique nonce to prevent replay attacks
    /// @return success Whether the call succeeded
    /// @return returnData The return data from the call
    function executeAuthorizedCall(
        address owner,
        address target,
        bytes calldata callData,
        uint256 value,
        bytes memory chipSignature,
        uint256 timestamp,
        bytes32 nonce
    ) external payable nonReentrant returns (bool success, bytes memory returnData) {
        require(owner != address(0), "Invalid owner");
        require(target != address(0), "Invalid target");
        require(msg.value >= value, "Insufficient ETH sent");

        // Check nonce hasn't been used
        require(!usedNonces[nonce], "Nonce already used");

        // Verify chip authorization
        address chip = _verifyChipAuth(owner, target, callData, value, timestamp, nonce, chipSignature);

        // Validate chip is registered to owner
        address chipOwner = registry.getOwner(chip);
        require(chipOwner != address(0), "Chip not registered");
        require(chipOwner == owner, "Chip owner mismatch");

        // Mark nonce as used
        usedNonces[nonce] = true;
        emit NonceUsed(nonce);

        // Execute the call
        (success, returnData) = target.call{ value: value }(callData);

        emit AuthorizedCallExecuted(owner, chip, target, callData, value, nonce, success);



        return (success, returnData);
    }

    /// @notice Verify chip authorization signature
    /// @param owner The chip owner
    /// @param target The target contract
    /// @param callData The call data
    /// @param value The ETH value
    /// @param timestamp The authorization timestamp
    /// @param nonce The unique nonce
    /// @param signature The chip signature
    /// @return address The verified chip address
    function verifyChipAuth(
        address owner,
        address target,
        bytes calldata callData,
        uint256 value,
        uint256 timestamp,
        bytes32 nonce,
        bytes memory signature
    ) public view returns (address) {
        return _verifyChipAuth(owner, target, callData, value, timestamp, nonce, signature);
    }

    /// @notice Internal function to verify chip authorization
    function _verifyChipAuth(
        address owner,
        address target,
        bytes calldata callData,
        uint256 value,
        uint256 timestamp,
        bytes32 nonce,
        bytes memory signature
    ) internal view returns (address) {
        // Create call auth struct
        TapThatXAuth.CallAuthorization memory auth = TapThatXAuth.CallAuthorization({
            owner: owner,
            target: target,
            callData: callData,
            value: value,
            timestamp: timestamp,
            nonce: nonce
        });

        // Validate timestamp
        require(
            TapThatXAuth.validateTimestamp(timestamp, MAX_TIMESTAMP_WINDOW), "Authorization expired"
        );

        // Recover chip address from signature
        address chip = TapThatXAuth.recoverChipFromCallAuth(_domainSeparatorV4(), auth, signature);

        require(chip != address(0), "Invalid chip signature");

        return chip;
    }

    /// @notice Get the EIP-712 domain separator
    /// @return bytes32 The domain separator
    function getDomainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /// @notice Allow contract to receive ETH
    receive() external payable { }
}
