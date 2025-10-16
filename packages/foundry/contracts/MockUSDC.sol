// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Mock USDC contract with EIP-2612 permit functionality for local testing
contract MockUSDC is ERC20Permit, Ownable {
    uint8 private constant DECIMALS = 6; // USDC uses 6 decimals

    constructor() ERC20("USD Coin", "USDC") ERC20Permit("USD Coin") Ownable(msg.sender) {
        // Mint 1 million USDC to deployer for testing
        _mint(msg.sender, 1_000_000 * 10**DECIMALS);
    }

    /// @notice Mint USDC tokens for testing
    /// @param to Address to mint tokens to
    /// @param amount Amount of tokens to mint (in smallest units)
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /// @notice Faucet function for easy testing - gives 1000 USDC
    /// @param to Address to send USDC to
    function faucet(address to) external {
        require(to != address(0), "Invalid address");
        _mint(to, 1000 * 10**DECIMALS);
    }

    /// @notice Override decimals to return 6 like real USDC
    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }
}
