// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @notice Minimal WETH interface for wrapping/unwrapping ETH
interface IWETH {
    /// @notice Wrap ETH to WETH
    function deposit() external payable;

    /// @notice Unwrap WETH to ETH
    /// @param amount Amount of WETH to unwrap
    function withdraw(uint256 amount) external;

    /// @notice Transfer WETH from one address to another
    /// @param from Source address
    /// @param to Destination address
    /// @param amount Amount to transfer
    /// @return success True if transfer succeeded
    function transferFrom(address from, address to, uint256 amount) external returns (bool);

    /// @notice Approve spender to spend WETH
    /// @param spender Address to approve
    /// @param amount Amount to approve
    /// @return success True if approval succeeded
    function approve(address spender, uint256 amount) external returns (bool);

    /// @notice Get WETH balance of account
    /// @param account Address to query
    /// @return balance WETH balance
    function balanceOf(address account) external view returns (uint256);

    /// @notice Check allowance for spender
    /// @param owner Token owner address
    /// @param spender Address allowed to spend
    /// @return remaining Amount spender is allowed to spend
    function allowance(address owner, address spender) external view returns (uint256);
}
