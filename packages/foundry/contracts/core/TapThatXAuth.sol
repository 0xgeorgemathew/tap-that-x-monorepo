// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title TapThatXAuth
/// @notice Authentication and signature verification library for Tap That X protocol
/// @dev Supports generic call authorization and legacy payment authorization
library TapThatXAuth {
    using ECDSA for bytes32;

    /// @notice Generic authorization for any contract call
    /// @dev Used by TapThatXProtocol for executing arbitrary authorized calls
    struct CallAuthorization {
        address owner;      // The chip owner (must match msg.sender in protocol)
        address target;     // Contract address to call
        bytes callData;     // Encoded function call
        uint256 value;      // ETH value to send (0 for no ETH)
        uint256 timestamp;  // When authorization was created
        bytes32 nonce;      // Unique nonce for replay protection
    }

    /// @notice Legacy payment authorization (kept for reference/backwards compatibility)
    /// @dev Used in example USDC payment implementation
    struct PaymentAuth {
        address from;
        address to;
        uint256 amount;
        uint256 timestamp;
        bytes32 nonce;
    }

    bytes32 constant CALL_AUTH_TYPEHASH = keccak256(
        "CallAuthorization(address owner,address target,bytes callData,uint256 value,uint256 timestamp,bytes32 nonce)"
    );

    bytes32 constant PAYMENT_AUTH_TYPEHASH =
        keccak256("PaymentAuth(address from,address to,uint256 amount,uint256 timestamp,bytes32 nonce)");

    /// @notice Validate if timestamp is within acceptable window
    /// @param timestamp The timestamp to validate
    /// @param maxWindow Maximum acceptable time difference in seconds
    /// @return bool True if timestamp is valid
    function validateTimestamp(uint256 timestamp, uint256 maxWindow) internal view returns (bool) {
        if (timestamp > block.timestamp) {
            return false; // Future timestamp
        }

        return (block.timestamp - timestamp) <= maxWindow;
    }

    /// @notice Recover chip address from generic call authorization signature
    /// @param domainSeparator The EIP-712 domain separator
    /// @param auth The call authorization struct
    /// @param signature The signature bytes
    /// @return address The recovered signer (chip) address
    function recoverChipFromCallAuth(bytes32 domainSeparator, CallAuthorization memory auth, bytes memory signature)
        internal
        pure
        returns (address)
    {
        bytes32 structHash = keccak256(
            abi.encode(
                CALL_AUTH_TYPEHASH, auth.owner, auth.target, keccak256(auth.callData), auth.value, auth.timestamp, auth.nonce
            )
        );

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));

        return digest.recover(signature);
    }

    /// @notice Recover chip address from payment authorization signature (legacy)
    /// @param domainSeparator The EIP-712 domain separator
    /// @param auth The payment authorization struct
    /// @param signature The signature bytes
    /// @return address The recovered signer (chip) address
    function recoverChipFromPaymentAuth(bytes32 domainSeparator, PaymentAuth memory auth, bytes memory signature)
        internal
        pure
        returns (address)
    {
        bytes32 structHash =
            keccak256(abi.encode(PAYMENT_AUTH_TYPEHASH, auth.from, auth.to, auth.amount, auth.timestamp, auth.nonce));

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));

        return digest.recover(signature);
    }
}
