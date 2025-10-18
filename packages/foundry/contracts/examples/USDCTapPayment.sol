// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../core/TapThatXProtocol.sol";
import "../core/TapThatXRegistry.sol";

/// @title USDCTapPayment
/// @notice Example implementation showing how to use Tap That X protocol for USDC payments
/// @dev Pure tap-to-pay using pre-approved allowances - no MetaMask popups during payment
contract USDCTapPayment is ReentrancyGuard {
    IERC20 public immutable usdc;
    TapThatXProtocol public immutable protocol;
    TapThatXRegistry public immutable registry;

    event TapPaymentExecuted(
        address indexed from, address indexed to, uint256 amount, address indexed chip, bytes32 nonce
    );

    constructor(address _usdc, address _protocol, address _registry) {
        require(_usdc != address(0), "Invalid USDC address");
        require(_protocol != address(0), "Invalid protocol address");
        require(_registry != address(0), "Invalid registry address");

        usdc = IERC20(_usdc);
        protocol = TapThatXProtocol(payable(_protocol));
        registry = TapThatXRegistry(_registry);
    }

    /// @notice Execute USDC payment using pre-approved allowance
    /// @dev User must have pre-approved this contract for USDC spending
    /// @param owner The USDC token owner (payer)
    /// @param recipient The payment recipient
    /// @param amount The amount of USDC to transfer
    /// @param chipSignature The chip's authorization signature
    /// @param timestamp When the chip authorization was created
    /// @param nonce Unique nonce for replay protection
    function tapToPay(
        address owner,
        address recipient,
        uint256 amount,
        bytes memory chipSignature,
        uint256 timestamp,
        bytes32 nonce
    ) external nonReentrant {
        require(owner != address(0), "Invalid owner");
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be > 0");

        // Build transferFrom call data
        bytes memory transferCallData = abi.encodeWithSelector(
            IERC20.transferFrom.selector,
            owner,
            address(this),
            amount
        );

        // Execute via protocol - this verifies chip authorization and executes transfer
        (bool success,) = protocol.executeAuthorizedCall(
            owner,
            address(usdc),
            transferCallData,
            0, // no ETH value
            chipSignature,
            timestamp,
            nonce
        );

        require(success, "Protocol execution failed");

        // Get chip address from protocol verification
        address chip = protocol.verifyChipAuth(
            owner,
            address(usdc),
            transferCallData,
            0,
            timestamp,
            nonce,
            chipSignature
        );

        emit TapPaymentExecuted(owner, recipient, amount, chip, nonce);
    }

    /// @notice Helper to check if owner has approved sufficient USDC
    /// @param owner The token owner
    /// @param amount The amount to check
    /// @return bool True if allowance is sufficient
    function checkAllowance(address owner, uint256 amount) external view returns (bool) {
        return usdc.allowance(owner, address(protocol)) >= amount;
    }

    /// @notice Get the required approval address (TapThatXProtocol)
    /// @return address The address that needs USDC approval
    function getApprovalTarget() external view returns (address) {
        return address(protocol);
    }
}
