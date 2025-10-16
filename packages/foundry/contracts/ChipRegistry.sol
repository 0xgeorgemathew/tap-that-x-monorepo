// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ChipRegistry is Ownable, ReentrancyGuard {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    mapping(address => address) public chipToOwner;

    event ChipRegistered(address indexed chip, address indexed owner);

    constructor() Ownable(msg.sender) { }

    /// @notice Register a new chip with ownership proof
    /// @param chipAddress The address derived from the chip's private key
    /// @param chipSignature Signature proving ownership of the chip
    function registerChip(address chipAddress, bytes memory chipSignature) external {
        require(chipAddress != address(0), "Invalid chip address");
        require(chipToOwner[chipAddress] == address(0), "Chip already registered");

        // Verify chip signature
        bytes32 messageHash = keccak256(abi.encodePacked(msg.sender, chipAddress));
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address signer = ethSignedHash.recover(chipSignature);

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
}
