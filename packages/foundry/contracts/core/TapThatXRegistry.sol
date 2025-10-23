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

    mapping(address => address[]) private ownerToChips;
    mapping(address => address[]) private chipToOwners;
    mapping(address => mapping(address => bool)) public ownerHasChip;

    bytes32 private constant REGISTRATION_TYPEHASH =
        keccak256("ChipRegistration(address owner,address chipAddress)");

    event ChipRegistered(address indexed chip, address indexed owner);

    constructor() Ownable(msg.sender) EIP712("TapThatXRegistry", "1") { }

    /// @notice Register a new chip with ownership proof using EIP-712
    /// @param chipAddress The address derived from the chip's private key
    /// @param chipSignature EIP-712 signature from the chip proving ownership
    function registerChip(address chipAddress, bytes memory chipSignature) external {
        require(chipAddress != address(0), "Invalid chip address");
        require(!ownerHasChip[msg.sender][chipAddress], "Chip already registered to this owner");

        // Verify EIP-712 chip signature (chain-agnostic)
        bytes32 structHash = keccak256(abi.encode(REGISTRATION_TYPEHASH, msg.sender, chipAddress));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _chainAgnosticDomainSeparator(), structHash));
        address signer = digest.recover(chipSignature);

        require(signer == chipAddress, "Invalid chip signature");

        // Add chip to owner's collection
        ownerToChips[msg.sender].push(chipAddress);

        // Add owner to chip's collection
        chipToOwners[chipAddress].push(msg.sender);

        // Mark ownership
        ownerHasChip[msg.sender][chipAddress] = true;

        emit ChipRegistered(chipAddress, msg.sender);
    }

    /// @notice Get all chips owned by an address
    /// @param owner The owner address
    /// @return address[] Array of chip addresses
    function getOwnerChips(address owner) external view returns (address[] memory) {
        return ownerToChips[owner];
    }

    /// @notice Get all owners of a chip
    /// @param chip The chip address
    /// @return address[] Array of owner addresses
    function getChipOwners(address chip) external view returns (address[] memory) {
        return chipToOwners[chip];
    }

    /// @notice Check if an owner has a specific chip
    /// @param owner The owner address
    /// @param chip The chip address
    /// @return bool True if owner has the chip
    function hasChip(address owner, address chip) external view returns (bool) {
        return ownerHasChip[owner][chip];
    }

    /// @notice Get the EIP-712 domain separator
    /// @return bytes32 The domain separator
    function getDomainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /// @notice Get the chain-agnostic domain separator used for chip registration
    /// @return bytes32 The chain-agnostic domain separator
    function getChainAgnosticDomainSeparator() external view returns (bytes32) {
        return _chainAgnosticDomainSeparator();
    }

    /// @notice Chain-agnostic domain separator (excludes chainId)
    function _chainAgnosticDomainSeparator() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,address verifyingContract)"),
                keccak256(bytes("TapThatXRegistry")),
                keccak256(bytes("1")),
                address(this)
            )
        );
    }
}
