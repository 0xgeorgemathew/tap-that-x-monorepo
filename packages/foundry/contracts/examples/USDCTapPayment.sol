// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../core/TapThatXProtocol.sol";

/// @title USDCTapPayment
/// @notice Example implementation showing how to use Tap That X protocol for USDC payments
/// @dev Pure tap-to-pay using pre-approved allowances - no MetaMask popups during payment
contract USDCTapPayment is ReentrancyGuard {
    IERC20 public immutable usdc;
    TapThatXProtocol public immutable protocol;

    event TapPaymentExecuted(
        address indexed owner, bytes32 nonce
    );

    constructor(address _usdc, address _protocol) {
        require(_usdc != address(0), "Invalid USDC address");
        require(_protocol != address(0), "Invalid protocol address");

        usdc = IERC20(_usdc);
        protocol = TapThatXProtocol(payable(_protocol));
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

        emit TapPaymentExecuted(owner, nonce);
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
