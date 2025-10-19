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
    /// @dev User must have pre-approved TapThatXProtocol for USDC spending
    /// @param owner The USDC token owner (payer)
    /// @param transferCallData The pre-built and signed transferFrom callData
    /// @param chipSignature The chip's authorization signature
    /// @param timestamp When the chip authorization was created
    /// @param nonce Unique nonce for replay protection
    function tapToPay(
        address owner,
        bytes calldata transferCallData,
        bytes memory chipSignature,
        uint256 timestamp,
        bytes32 nonce
    ) external nonReentrant {
        require(owner != address(0), "Invalid owner");
        require(transferCallData.length > 0, "Invalid callData");

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

        // Decode recipient and amount from callData for event
        // transferFrom selector is 0x23b872dd, followed by from, to, amount
        address recipient;
        uint256 amount;
        assembly {
            // Skip 4 bytes (selector) + 32 bytes (from) = 36 bytes
            recipient := calldataload(add(transferCallData.offset, 36))
            // Skip 4 bytes (selector) + 32 bytes (from) + 32 bytes (to) = 68 bytes
            amount := calldataload(add(transferCallData.offset, 68))
        }

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
