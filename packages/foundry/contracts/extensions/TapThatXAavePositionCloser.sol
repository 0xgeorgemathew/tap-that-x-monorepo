// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@aave/core-v3/contracts/interfaces/IPool.sol";
import "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";
import "@aave/core-v3/contracts/interfaces/IAaveOracle.sol";
import "@aave/core-v3/contracts/protocol/libraries/types/DataTypes.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/IUniswapV2.sol";

/// @title TapThatXAavePositionCloser
/// @notice Flash loan-based Aave position closer for NFC chip authorization
/// @dev Completely closes an Aave position: repays all debt, withdraws all collateral
contract TapThatXAavePositionCloser is ReentrancyGuard {
    /// @notice Aave V3 Pool
    IPool public immutable POOL;

    /// @notice TapThatX Protocol address (authorized caller)
    address public immutable TAPTHATX_PROTOCOL;

    /// @notice Base Sepolia Uniswap V2 Router
    address private constant UNISWAP_V2_ROUTER = 0x1689E7B1F10000AE47eBfE339a4f69dECd19F602;

    /// @notice Base Sepolia Uniswap V2 Factory
    address private constant UNISWAP_V2_FACTORY = 0x7Ae58f10f7849cA6F5fB71b7f45CB416c9204b1e;

    /// @notice Configuration for closing operation
    struct CloseConfig {
        address collateralAsset; // e.g., WETH
        address debtAsset; // e.g., USDT
        uint256 maxSlippage; // Max slippage in basis points (e.g., 100 = 1%)
    }

    /// @notice Emitted when a position is successfully closed
    event PositionClosed(
        address indexed owner,
        uint256 debtRepaid,
        uint256 collateralWithdrawn,
        uint256 collateralSwapped,
        uint256 excessReturned
    );

    /// @notice Emitted when a flash loan is executed
    event FlashLoanExecuted(address indexed asset, uint256 amount, uint256 premium);

    /// @notice Errors
    error InvalidAddress();
    error NoDebtToClose();
    error NoCollateralToWithdraw();
    error SwapOutputInsufficient();
    error UnauthorizedFlashLoan();
    error PositionNotFullyClosed();
    error Unauthorized();

    /// @notice Constructor accepting Aave Pool and TapThatX Protocol addresses
    /// @param poolAddress Address of the Aave V3 Pool contract
    /// @param protocolAddress Address of the TapThatX Protocol contract
    constructor(address poolAddress, address protocolAddress) {
        if (poolAddress == address(0) || protocolAddress == address(0)) revert InvalidAddress();
        POOL = IPool(poolAddress);
        TAPTHATX_PROTOCOL = protocolAddress;
    }

    /// @notice Calculate flash loan amount needed (user's total debt in specific asset)
    /// @param owner Position owner address
    /// @param debtAsset Debt asset to query
    /// @return flashLoanAmount Amount of debt to repay
    function calculateFlashLoanAmount(address owner, address debtAsset)
        public
        view
        returns (uint256 flashLoanAmount)
    {
        // Get user's reserve data for the debt asset
        DataTypes.ReserveData memory reserveData = POOL.getReserveData(debtAsset);
        address variableDebtToken = reserveData.variableDebtTokenAddress;

        // Query user's variable debt balance
        flashLoanAmount = IERC20(variableDebtToken).balanceOf(owner);

        return flashLoanAmount;
    }

    /// @notice Close Aave position completely via flash loan
    /// @dev Called by TapThatXProtocol after chip authorization validation
    /// @param owner The position owner (must have approved aToken spending)
    /// @param config Closing parameters
    function closePosition(address owner, CloseConfig calldata config) external nonReentrant {
        // Access control: only protocol or position owner can execute
        if (msg.sender != TAPTHATX_PROTOCOL && msg.sender != owner) revert Unauthorized();

        if (owner == address(0)) revert InvalidAddress();
        if (config.collateralAsset == address(0) || config.debtAsset == address(0)) revert InvalidAddress();

        // Calculate flash loan amount (total debt)
        uint256 flashLoanAmount = calculateFlashLoanAmount(owner, config.debtAsset);

        if (flashLoanAmount == 0) revert NoDebtToClose();

        // Encode params for flash loan callback
        bytes memory params = abi.encode(owner, config);

        // Initiate flash loan with full debt amount
        POOL.flashLoanSimple(address(this), config.debtAsset, flashLoanAmount, params, 0);
    }

    /// @notice Flash loan callback - executes atomic position closing
    /// @dev Called by Aave Pool during flash loan execution
    /// @param asset The borrowed asset address
    /// @param amount The borrowed amount (user's total debt)
    /// @param premium The flash loan fee (0.09% on Aave V3)
    /// @param initiator The address that initiated the flash loan
    /// @param params Encoded parameters (owner, config)
    /// @return bool True if successful (Aave auto-pulls repayment)
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external returns (bool) {
        // Security: only accept flash loans we initiated
        if (msg.sender != address(POOL)) revert UnauthorizedFlashLoan();
        if (initiator != address(this)) revert UnauthorizedFlashLoan();

        emit FlashLoanExecuted(asset, amount, premium);

        // Decode params
        (address owner, CloseConfig memory config) = abi.decode(params, (address, CloseConfig));

        // Step 1: Repay ALL user's debt using flash loan
        IERC20(config.debtAsset).approve(address(POOL), amount);
        POOL.repay(config.debtAsset, amount, 2, owner); // 2 = variable rate

        // Step 2: Withdraw ALL collateral (now that debt is zero)
        DataTypes.ReserveData memory reserveData = POOL.getReserveData(config.collateralAsset);
        address aToken = reserveData.aTokenAddress;

        // Get user's full aToken balance
        uint256 aTokenBalance = IERC20(aToken).balanceOf(owner);

        if (aTokenBalance == 0) revert NoCollateralToWithdraw();

        // Transfer aToken from user to this contract
        IERC20(aToken).transferFrom(owner, address(this), aTokenBalance);

        // Burn aToken to receive underlying collateral
        POOL.withdraw(config.collateralAsset, aTokenBalance, address(this));

        // Step 3: Calculate minimum collateral needed to repay flash loan
        uint256 totalRepayment = amount + premium;
        uint256 minCollateralNeeded = _calculateCollateralAmount(config, totalRepayment);

        // Step 4: Swap enough collateral to cover flash loan repayment
        uint256 swapOutput = _swapV2(
            config.collateralAsset,
            config.debtAsset,
            minCollateralNeeded,
            totalRepayment
        );

        // Validate swap output covers flash loan repayment
        if (swapOutput < totalRepayment) revert SwapOutputInsufficient();

        // Step 5: Approve Aave to pull flash loan repayment
        IERC20(config.debtAsset).approve(address(POOL), totalRepayment);

        // Step 6: Return remaining collateral and excess debt tokens to user
        uint256 remainingCollateral = aTokenBalance - minCollateralNeeded;
        if (remainingCollateral > 0) {
            IERC20(config.collateralAsset).transfer(owner, remainingCollateral);
        }

        uint256 excessDebtToken = swapOutput - totalRepayment;
        if (excessDebtToken > 0) {
            IERC20(config.debtAsset).transfer(owner, excessDebtToken);
        }

        // Step 7: Validate position is fully closed
        uint256 remainingDebt = calculateFlashLoanAmount(owner, config.debtAsset);
        if (remainingDebt > 0) revert PositionNotFullyClosed();

        emit PositionClosed(owner, amount, aTokenBalance, minCollateralNeeded, excessDebtToken);

        return true; // Aave automatically pulls totalRepayment
    }

    /// @notice Calculate collateral amount needed to cover flash loan repayment
    /// @dev Uses Uniswap V2 calculation with slippage buffer
    /// @param config Closing configuration
    /// @param totalRepayment Flash loan amount + premium
    /// @return uint256 Collateral amount needed (with slippage buffer)
    function _calculateCollateralAmount(CloseConfig memory config, uint256 totalRepayment)
        internal
        view
        returns (uint256)
    {
        // Get Uniswap V2 pair
        address pair = _getPair(config.collateralAsset, config.debtAsset);
        if (pair == address(0)) return 0;

        // Get reserves
        (uint112 reserve0, uint112 reserve1,) = IUniswapV2Pair(pair).getReserves();
        address token0 = IUniswapV2Pair(pair).token0();

        // Determine which reserve is which token
        (uint112 reserveCollateral, uint112 reserveDebt) = token0 == config.collateralAsset
            ? (reserve0, reserve1)
            : (reserve1, reserve0);

        // Calculate amountIn needed for totalRepayment output
        // Formula: amountIn = (reserveIn * amountOut * 1000) / ((reserveOut - amountOut) * 997) + 1
        uint256 numerator = uint256(reserveCollateral) * totalRepayment * 1000;
        uint256 denominator = (uint256(reserveDebt) - totalRepayment) * 997;
        uint256 amountIn = (numerator / denominator) + 1;

        // Add slippage buffer
        uint256 slippageMultiplier = 10000 + config.maxSlippage;
        uint256 amountInWithSlippage = (amountIn * slippageMultiplier) / 10000;

        return amountInWithSlippage;
    }

    /// @notice Swap collateral for debt asset on Uniswap V2
    /// @param tokenIn Collateral asset
    /// @param tokenOut Debt asset
    /// @param amountIn Amount of collateral to swap
    /// @param minAmountOut Minimum output required
    /// @return uint256 Actual output amount received
    function _swapV2(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut)
        internal
        returns (uint256)
    {
        // Build swap path
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        // Approve router to spend tokenIn
        IERC20(tokenIn).approve(UNISWAP_V2_ROUTER, amountIn);

        // Execute swap
        uint256[] memory amounts = IUniswapV2Router02(UNISWAP_V2_ROUTER).swapExactTokensForTokens(
            amountIn, minAmountOut, path, address(this), block.timestamp
        );

        return amounts[1]; // Output amount
    }

    /// @notice Get Uniswap V2 pair address
    /// @param tokenA First token
    /// @param tokenB Second token
    /// @return address Pair address (0x0 if not exists)
    function _getPair(address tokenA, address tokenB) internal view returns (address) {
        return IUniswapV2Factory(UNISWAP_V2_FACTORY).getPair(tokenA, tokenB);
    }

    /// @notice Preview position closing outcome (view function)
    /// @param owner Position owner
    /// @param config Closing configuration
    /// @return currentDebt Current debt amount
    /// @return currentCollateral Current collateral amount (aToken balance)
    /// @return estimatedCollateralToSwap Estimated collateral needed for swap
    /// @return estimatedCollateralReturned Estimated remaining collateral returned to user
    function previewClose(address owner, CloseConfig calldata config)
        external
        view
        returns (
            uint256 currentDebt,
            uint256 currentCollateral,
            uint256 estimatedCollateralToSwap,
            uint256 estimatedCollateralReturned
        )
    {
        // Get current debt
        currentDebt = calculateFlashLoanAmount(owner, config.debtAsset);

        // Get current collateral (aToken balance)
        DataTypes.ReserveData memory reserveData = POOL.getReserveData(config.collateralAsset);
        address aToken = reserveData.aTokenAddress;
        currentCollateral = IERC20(aToken).balanceOf(owner);

        if (currentDebt > 0) {
            // Calculate flash loan repayment
            uint256 totalRepayment = currentDebt + (currentDebt * 9) / 10000; // 0.09% premium

            // Calculate collateral needed to swap
            estimatedCollateralToSwap = _calculateCollateralAmount(config, totalRepayment);

            // Calculate remaining collateral returned to user
            if (currentCollateral > estimatedCollateralToSwap) {
                estimatedCollateralReturned = currentCollateral - estimatedCollateralToSwap;
            }
        }
    }

    /// @notice Check if owner has approved sufficient aToken spending
    /// @param owner Position owner
    /// @param collateralAsset Collateral asset address
    /// @return hasApproval True if approval is sufficient
    /// @return aTokenAddress The aToken address that needs approval
    /// @return currentAllowance Current approval amount
    function checkATokenApproval(address owner, address collateralAsset)
        external
        view
        returns (bool hasApproval, address aTokenAddress, uint256 currentAllowance)
    {
        DataTypes.ReserveData memory reserveData = POOL.getReserveData(collateralAsset);
        aTokenAddress = reserveData.aTokenAddress;
        currentAllowance = IERC20(aTokenAddress).allowance(owner, address(this));
        hasApproval = currentAllowance > 0;
    }

    /// @notice Get the aToken address for a given collateral asset
    /// @param collateralAsset Collateral asset address
    /// @return aTokenAddress The corresponding aToken address
    function getATokenAddress(address collateralAsset) external view returns (address aTokenAddress) {
        DataTypes.ReserveData memory reserveData = POOL.getReserveData(collateralAsset);
        aTokenAddress = reserveData.aTokenAddress;
    }
}
