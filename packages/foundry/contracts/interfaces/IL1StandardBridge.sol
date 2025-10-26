// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @notice Optimism/Base L1StandardBridge interface for bridging ETH to L2
/// @dev Both OP and Base use the same interface for their L1 bridges
interface IL1StandardBridge {
    /// @notice Bridge ETH to a recipient on L2 (OP Mainnet version)
    /// @param _to Address of recipient on L2
    /// @param _minGasLimit Minimum gas limit for L2 execution (200000 recommended)
    /// @param _extraData Extra data to pass to L2 (usually empty bytes)
    function depositETHTo(
        address _to,
        uint32 _minGasLimit,
        bytes calldata _extraData
    ) external payable;

    /// @notice Deprecated: Use depositETHTo instead
    /// @dev This function is kept for backwards compatibility documentation only
    /// @param _to Address of recipient on L2
    /// @param _minGasLimit Minimum gas limit for L2 execution
    /// @param _extraData Extra data to pass to L2
    // function depositETHTo(address _to, uint32 _minGasLimit, bytes calldata _extraData) external payable;
}
