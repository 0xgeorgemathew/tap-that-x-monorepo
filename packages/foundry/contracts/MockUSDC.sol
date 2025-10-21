// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Mock USDC contract with EIP-2612 permit functionality for local testing
contract MockUSDC is ERC20Permit, Ownable {
    uint8 private constant DECIMALS = 6; // USDC uses 6 decimals

    constructor() ERC20("USD Coin", "USDC") ERC20Permit("USD Coin") Ownable(msg.sender) {
        // Mint 1 million USDC to deployer for testing
        _mint(msg.sender, 1_000_000 * 10 ** DECIMALS);
        _mint(0x59d4C5BE20B41139494b3F1ba2A745ad9e71B00B, 1_000_000 * 10 ** DECIMALS);
        _mint(0x180c5f2aBF35442Fb4425A1edBF3B5faDFc2208D, 1_000_000 * 10 ** DECIMALS);
        _mint(0x04aDa81c30ea0D0ab3C66555F8b446E0074ec001, 1_000_000 * 10 ** DECIMALS);
        _mint(0x3A308d0B3E1a4bC83Aa7DAAcdC61c682D1A0D246, 1_000_000 * 10 ** DECIMALS);
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
        _mint(to, 1000 * 10 ** DECIMALS);
    }

    /// @notice Override decimals to return 6 like real USDC
    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }
}
