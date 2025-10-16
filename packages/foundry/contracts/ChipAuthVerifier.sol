// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

library ChipAuthVerifier {
    using ECDSA for bytes32;

    struct PaymentAuth {
        address from;
        address to;
        uint256 amount;
        uint256 timestamp;
        bytes32 nonce;
    }

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

    /// @notice Recover the chip address from an EIP-712 signature
    /// @param domainSeparator The EIP-712 domain separator
    /// @param auth The payment authorization struct
    /// @param signature The signature bytes
    /// @return address The recovered signer address
    function recoverChipAddress(bytes32 domainSeparator, PaymentAuth memory auth, bytes memory signature)
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
