// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IWETH } from "../interfaces/IWETH.sol";
import { IL1StandardBridge } from "../interfaces/IL1StandardBridge.sol";
import { TapThatXProtocol } from "../core/TapThatXProtocol.sol";

/// @title TapThatXBridgeETHViaWETH
/// @notice Bridge ETH to OP Sepolia + Base Sepolia by unwrapping user's WETH
/// @dev Enables gasless bridging: user pre-approves WETH, protocol pulls and unwraps
///      Bridges to Base first, then remaining balance to OP (safe for odd amounts)
/// @author TapThatX Team
contract TapThatXBridgeETHViaWETH {
    /// @notice WETH token contract on Sepolia
    IWETH public immutable weth;

    /// @notice L1StandardBridge for OP Sepolia
    IL1StandardBridge public immutable bridgeOP;

    /// @notice L1StandardBridge for Base Sepolia
    IL1StandardBridge public immutable bridgeBase;

    /// @notice TapThatXProtocol contract (only this contract can call unwrapAndBridgeDual)
    TapThatXProtocol public immutable protocol;

    /// @notice Emitted when ETH is bridged to both chains via WETH
    /// @param owner User whose WETH was pulled and unwrapped (also receives ETH on L2s)
    /// @param amountBase Amount bridged to Base Sepolia
    /// @param amountOP Amount bridged to OP Sepolia
    /// @param minGasLimitBase Gas limit for Base bridge
    /// @param minGasLimitOP Gas limit for OP bridge
    event ETHBridgedViaWETH(
        address indexed owner,
        uint256 amountBase,
        uint256 amountOP,
        uint32 minGasLimitBase,
        uint32 minGasLimitOP
    );

    /// @notice Constructor sets immutable references
    /// @param _weth WETH contract address (Sepolia: 0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9)
    /// @param _bridgeOP OP L1StandardBridge (Sepolia→OP: 0xFBb0621E0B23b5478B630BD55a5f21f67730B0F1)
    /// @param _bridgeBase Base L1StandardBridge (Sepolia→Base: 0xfd0Bf71F60660E2f608ed56e1659C450eB113120)
    /// @param _protocol TapThatXProtocol contract address
    constructor(address _weth, address _bridgeOP, address _bridgeBase, address _protocol) {
        require(_weth != address(0), "Invalid WETH address");
        require(_bridgeOP != address(0), "Invalid OP bridge address");
        require(_bridgeBase != address(0), "Invalid Base bridge address");
        require(_protocol != address(0), "Invalid protocol address");

        weth = IWETH(_weth);
        bridgeOP = IL1StandardBridge(_bridgeOP);
        bridgeBase = IL1StandardBridge(_bridgeBase);
        protocol = TapThatXProtocol(payable(_protocol));
    }

    /// @notice Unwrap WETH from user and bridge to both OP Sepolia and Base Sepolia
    /// @dev Only callable by TapThatXProtocol. User must pre-approve WETH to this contract.
    ///      Automatically bridges maximum available WETH (minimum of balance and allowance).
    ///      Owner receives ETH on both L2s at the same address.
    /// @param owner User whose WETH will be pulled (must have approved this contract)
    ///              Also the recipient address on both L2s
    /// @param minGasLimitOP Minimum gas limit for OP bridge execution (200000 recommended)
    /// @param minGasLimitBase Minimum gas limit for Base bridge execution (200000 recommended)
    function unwrapAndBridgeDual(
        address owner,
        uint32 minGasLimitOP,
        uint32 minGasLimitBase
    ) external {
        // Security: Only TapThatXProtocol can call this (prevents direct calls)
        require(msg.sender == address(protocol), "Only protocol can call");
        require(owner != address(0), "Invalid owner");

        // Get user's WETH balance
        uint256 wethBalance = weth.balanceOf(owner);
        require(wethBalance > 0, "No WETH balance available");

        // Get approved allowance for this contract
        uint256 allowance = weth.allowance(owner, address(this));
        require(allowance > 0, "No WETH allowance for bridge");

        // Use minimum of balance and allowance (auto-max available WETH)
        uint256 wethAmountTotal = wethBalance < allowance ? wethBalance : allowance;

        // Pull WETH from user (requires prior approval)
        // This is why it's gasless - user pre-approved WETH like any ERC20 token
        require(
            weth.transferFrom(owner, address(this), wethAmountTotal),
            "WETH transfer failed"
        );

        // Unwrap WETH → receive native ETH in this contract
        weth.withdraw(wethAmountTotal);

        // Calculate amounts for dual-chain bridging
        // Bridge to Base first (half), then remaining to OP (safe for odd amounts)
        uint256 amountToBase = wethAmountTotal / 2;
        uint256 amountToOP = wethAmountTotal - amountToBase; // Remaining balance

        // Bridge native ETH to owner on Base Sepolia
        bridgeBase.depositETHTo{ value: amountToBase }(
            owner, // Owner receives ETH on L2
            minGasLimitBase,
            "" // empty extraData
        );

        // Bridge remaining native ETH to owner on OP Sepolia
        bridgeOP.depositETHTo{ value: amountToOP }(
            owner, // Owner receives ETH on L2
            minGasLimitOP,
            "" // empty extraData
        );

        emit ETHBridgedViaWETH(
            owner,
            amountToBase,
            amountToOP,
            minGasLimitBase,
            minGasLimitOP
        );
    }

    /// @notice Receive ETH from WETH.withdraw()
    /// @dev Only accepts ETH from WETH contract to prevent accidental sends
    receive() external payable {
        require(msg.sender == address(weth), "Only WETH can send ETH");
    }
}
