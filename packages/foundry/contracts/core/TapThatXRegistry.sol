// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title TapThatXRegistry
/// @notice Core registry for Tap That X protocol - manages chip registration and ownership
/// @dev Chips prove ownership via EIP-712 signatures
contract TapThatXRegistry is Ownable, ReentrancyGuard, EIP712 {
    using ECDSA for bytes32;

    mapping(address => address) public chipToOwner;

    bytes32 private constant REGISTRATION_TYPEHASH =
        keccak256("ChipRegistration(address owner,address chipAddress)");

    event ChipRegistered(address indexed chip, address indexed owner);

    constructor() Ownable(msg.sender) EIP712("TapThatXRegistry", "1") { }

    /// @notice Register a new chip with ownership proof using EIP-712
    /// @param chipAddress The address derived from the chip's private key
    /// @param chipSignature EIP-712 signature from the chip proving ownership
    function registerChip(address chipAddress, bytes memory chipSignature) external {
        require(chipAddress != address(0), "Invalid chip address");
        // require(chipToOwner[chipAddress] == address(0), "Chip already registered");

        // Verify EIP-712 chip signature
        bytes32 structHash = keccak256(abi.encode(REGISTRATION_TYPEHASH, msg.sender, chipAddress));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _domainSeparatorV4(), structHash));
        address signer = digest.recover(chipSignature);

        require(signer == chipAddress, "Invalid chip signature");

        chipToOwner[chipAddress] = msg.sender;

        emit ChipRegistered(chipAddress, msg.sender);
    }

    /// @notice Get the owner of a registered chip
    /// @param chip The chip address
    /// @return address The owner address, or address(0) if not registered
    function getOwner(address chip) external view returns (address) {
        return chipToOwner[chip];
    }

    /// @notice Check if a chip is registered
    /// @param chip The chip address
    /// @return bool True if chip is registered
    function isChipRegistered(address chip) external view returns (bool) {
        return chipToOwner[chip] != address(0);
    }

    /// @notice Get the EIP-712 domain separator
    /// @return bytes32 The domain separator
    function getDomainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
