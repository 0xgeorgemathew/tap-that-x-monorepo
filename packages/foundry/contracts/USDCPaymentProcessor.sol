// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ChipRegistry.sol";
import "./ChipAuthVerifier.sol";

contract USDCPaymentProcessor is EIP712, ReentrancyGuard {
    using ECDSA for bytes32;
    using ChipAuthVerifier for ChipAuthVerifier.PaymentAuth;

    IERC20Permit public immutable usdc;
    IERC20 private immutable _usdcERC20;
    ChipRegistry public immutable chipRegistry;
    uint256 public constant MAX_DURATION_WINDOW = 300; // 5 minutes

    mapping(bytes32 => bool) public usedSignatures;

    bytes32 private constant PAYMENT_TYPEHASH = keccak256(
        "Payment(address from,address to,uint256 amount,uint256 timestamp,bytes32 nonce)"
    );

    event PaymentAuthorized(
        address indexed from,
        address indexed to,
        uint256 amount,
        address indexed chip,
        bytes32 nonce
    );

    event SignatureUsed(bytes32 indexed signatureHash);

    constructor(address _usdc, address _chipRegistry)
        EIP712("USDCPaymentProcessor", "1")
    {
        require(_usdc != address(0), "Invalid USDC address");
        require(_chipRegistry != address(0), "Invalid ChipRegistry address");

        usdc = IERC20Permit(_usdc);
        _usdcERC20 = IERC20(_usdc);
        chipRegistry = ChipRegistry(_chipRegistry);
    }

    /// @notice Execute permit + transfer in single transaction
    /// @param owner The USDC token owner
    /// @param recipient The payment recipient
    /// @param amount The amount of USDC to transfer (in USDC's smallest units)
    /// @param deadline The permit deadline
    /// @param v The v component of the permit signature
    /// @param r The r component of the permit signature
    /// @param s The s component of the permit signature
    /// @param chipSignature The chip's authorization signature
    /// @param timestamp The timestamp when the chip signature was created
    /// @param nonce A unique nonce to prevent replay attacks
    function executePermitPayment(
        address owner,
        address recipient,
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s,
        bytes memory chipSignature,
        uint256 timestamp,
        bytes32 nonce
    ) external nonReentrant {
        require(owner != address(0), "Invalid owner");
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be > 0");

        // Check signature hasn't been used
        bytes32 signatureHash = keccak256(chipSignature);
        require(!usedSignatures[signatureHash], "Signature already used");

        // Verify chip authorization
        address chip = _verifyChipAuth(owner, recipient, amount, timestamp, nonce, chipSignature);

        // Validate chip is registered and owner matches
        address chipOwner = chipRegistry.getOwner(chip);
        require(chipOwner != address(0), "Chip not registered");
        require(chipOwner == owner, "Chip owner mismatch");

        // Mark signature as used
        usedSignatures[signatureHash] = true;
        emit SignatureUsed(signatureHash);

        // Execute permit to approve this contract
        usdc.permit(owner, address(this), amount, deadline, v, r, s);

        // Transfer USDC from owner to recipient
        require(_usdcERC20.transferFrom(owner, recipient, amount), "Transfer failed");

        emit PaymentAuthorized(owner, recipient, amount, chip, nonce);
    }

    /// @notice Verify chip authorization signature
    /// @param from The token owner
    /// @param to The recipient
    /// @param amount The payment amount
    /// @param timestamp The signature timestamp
    /// @param nonce The unique nonce
    /// @param signature The chip signature
    /// @return address The verified chip address
    function verifyChipAuth(
        address from,
        address to,
        uint256 amount,
        uint256 timestamp,
        bytes32 nonce,
        bytes memory signature
    ) public view returns (address) {
        return _verifyChipAuth(from, to, amount, timestamp, nonce, signature);
    }

    /// @notice Internal function to verify chip authorization
    function _verifyChipAuth(
        address from,
        address to,
        uint256 amount,
        uint256 timestamp,
        bytes32 nonce,
        bytes memory signature
    ) internal view returns (address) {
        // Create payment auth struct
        ChipAuthVerifier.PaymentAuth memory auth = ChipAuthVerifier.PaymentAuth({
            from: from,
            to: to,
            amount: amount,
            timestamp: timestamp,
            nonce: nonce
        });

        // Validate timestamp
        require(
            ChipAuthVerifier.validateTimestamp(timestamp, MAX_DURATION_WINDOW),
            "Signature expired"
        );

        // Recover chip address from signature
        address chip = ChipAuthVerifier.recoverChipAddress(
            _domainSeparatorV4(),
            auth,
            signature
        );

        require(chip != address(0), "Invalid chip signature");

        return chip;
    }

}
