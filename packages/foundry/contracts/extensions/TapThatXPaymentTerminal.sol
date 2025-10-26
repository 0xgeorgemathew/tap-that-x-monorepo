// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { TapThatXRegistry } from "../core/TapThatXRegistry.sol";
import { TapThatXProtocol } from "../core/TapThatXProtocol.sol";

/// @title TapThatXPaymentTerminal
/// @notice Single-device payment terminal for merchant tap → customer tap → payment
/// @dev Customer must pre-approve token to this contract. Payment executes transferFrom(customer, merchant, amount).
/// @author TapThatX Team
contract TapThatXPaymentTerminal is EIP712, ReentrancyGuard {
    using ECDSA for bytes32;

    /// @notice Registry contract for chip ownership validation
    TapThatXRegistry public immutable registry;

    /// @notice Protocol contract reference
    TapThatXProtocol public immutable protocol;

    /// @notice Maximum time window for payment authorization (5 minutes)
    uint256 public constant MAX_TIMESTAMP_WINDOW = 300;

    /// @notice Tracking used nonces to prevent replay attacks
    mapping(bytes32 => bool) public usedNonces;

    /// @notice Payment authorization struct for EIP-712 signing
    /// @dev Payer's chip signs this authorization
    struct PaymentAuthorization {
        address payer;          // Customer address (token owner)
        address payerChip;      // Customer's chip address
        address payee;          // Merchant address (recipient)
        address payeeChip;      // Merchant's chip address
        address token;          // Token address (PYUSD)
        uint256 amount;         // Amount to transfer
        uint256 timestamp;      // Authorization timestamp
        bytes32 nonce;          // Unique nonce
    }

    /// @notice EIP-712 typehash for PaymentAuthorization
    bytes32 private constant PAYMENT_AUTH_TYPEHASH = keccak256(
        "PaymentAuthorization(address payer,address payerChip,address payee,address payeeChip,address token,uint256 amount,uint256 timestamp,bytes32 nonce)"
    );

    /// @notice Emitted when payment is successfully executed
    event PaymentExecuted(
        address indexed payer,
        address indexed payerChip,
        address indexed payee,
        address payeeChip,
        address token,
        uint256 amount,
        bytes32 nonce
    );

    /// @notice Emitted when nonce is used
    event NonceUsed(bytes32 indexed nonce);

    /// @notice Constructor
    /// @param _registry TapThatXRegistry contract address
    /// @param _protocol TapThatXProtocol contract address
    constructor(address _registry, address _protocol) EIP712("TapThatXPaymentTerminal", "1") {
        require(_registry != address(0), "Invalid registry address");
        require(_protocol != address(0), "Invalid protocol address");
        registry = TapThatXRegistry(_registry);
        protocol = TapThatXProtocol(payable(_protocol));
    }

    /// @notice Execute payment from customer to merchant
    /// @dev Validates both chips are registered, verifies payer's signature, executes transferFrom
    /// @param auth PaymentAuthorization struct containing payment details
    /// @param payerSignature Payer's chip signature authorizing payment
    function executePayment(
        PaymentAuthorization calldata auth,
        bytes memory payerSignature
    ) external nonReentrant {
        // Validate inputs
        require(auth.payer != address(0), "Invalid payer address");
        require(auth.payee != address(0), "Invalid payee address");
        require(auth.payerChip != address(0), "Invalid payer chip");
        require(auth.payeeChip != address(0), "Invalid payee chip");
        require(auth.token != address(0), "Invalid token address");
        require(auth.amount > 0, "Amount must be greater than 0");

        // Validate both chips are registered
        require(registry.hasChip(auth.payer, auth.payerChip), "Payer does not own chip");
        require(registry.hasChip(auth.payee, auth.payeeChip), "Payee does not own chip");

        // Validate nonce not used (replay protection)
        require(!usedNonces[auth.nonce], "Nonce already used");

        // Validate timestamp (not expired)
        require(auth.timestamp <= block.timestamp, "Future timestamp");
        require(block.timestamp - auth.timestamp <= MAX_TIMESTAMP_WINDOW, "Authorization expired");

        // Verify payer's chip signed this authorization
        address recoveredChip = _recoverPayerChip(auth, payerSignature);
        require(recoveredChip == auth.payerChip, "Invalid payer signature");

        // Mark nonce as used
        usedNonces[auth.nonce] = true;
        emit NonceUsed(auth.nonce);

        // Execute token transfer: customer → merchant
        // Customer must have pre-approved this contract to spend tokens
        IERC20 token = IERC20(auth.token);
        require(
            token.transferFrom(auth.payer, auth.payee, auth.amount),
            "Token transfer failed"
        );

        emit PaymentExecuted(
            auth.payer,
            auth.payerChip,
            auth.payee,
            auth.payeeChip,
            auth.token,
            auth.amount,
            auth.nonce
        );
    }

    /// @notice Recover payer chip address from signature
    /// @param auth PaymentAuthorization struct
    /// @param signature Signature bytes
    /// @return address Recovered chip address
    function _recoverPayerChip(
        PaymentAuthorization calldata auth,
        bytes memory signature
    ) internal view returns (address) {
        bytes32 structHash = keccak256(
            abi.encode(
                PAYMENT_AUTH_TYPEHASH,
                auth.payer,
                auth.payerChip,
                auth.payee,
                auth.payeeChip,
                auth.token,
                auth.amount,
                auth.timestamp,
                auth.nonce
            )
        );

        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", _chainAgnosticDomainSeparator(), structHash)
        );

        return digest.recover(signature);
    }

    /// @notice Public function to verify payment authorization signature
    /// @param auth PaymentAuthorization struct
    /// @param signature Signature bytes
    /// @return address Recovered chip address
    function verifyPaymentAuth(
        PaymentAuthorization calldata auth,
        bytes memory signature
    ) external view returns (address) {
        return _recoverPayerChip(auth, signature);
    }

    /// @notice Get chain-agnostic domain separator
    /// @return bytes32 Domain separator
    function getChainAgnosticDomainSeparator() external view returns (bytes32) {
        return _chainAgnosticDomainSeparator();
    }

    /// @notice Chain-agnostic domain separator (excludes chainId for cross-chain chip reuse)
    function _chainAgnosticDomainSeparator() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,address verifyingContract)"),
                keccak256(bytes("TapThatXPaymentTerminal")),
                keccak256(bytes("1")),
                address(this)
            )
        );
    }
}
