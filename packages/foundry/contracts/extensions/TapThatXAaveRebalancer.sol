// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@aave/core-v3/contracts/flashloan/base/FlashLoanSimpleReceiverBase.sol";
import "@aave/core-v3/contracts/interfaces/IPool.sol";
import "@aave/core-v3/contracts/protocol/libraries/types/DataTypes.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title TapThatXAaveRebalancer
/// @notice Flash loan-based Aave position rebalancer for NFC chip authorization
/// @dev Integrates with TapThatX protocol - chip auth validated before calling
contract TapThatXAaveRebalancer is FlashLoanSimpleReceiverBase, ReentrancyGuard {
    /// @notice Base Sepolia Aave Pool Address Provider
    address private constant POOL_ADDRESS_PROVIDER = 0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D;

    /// @notice Base Sepolia Uniswap V2 Router
    address private constant UNISWAP_V2_ROUTER = 0x1689E7B1F10000AE47eBfE339a4f69dECd19F602;

    /// @notice Base Sepolia Uniswap V2 Factory
    address private constant UNISWAP_V2_FACTORY = 0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6;

    /// @notice Configuration for a rebalancing operation
    struct RebalanceConfig {
        address collateralAsset; // e.g., WETH
        address debtAsset; // e.g., USDT
        uint256 flashLoanAmount; // Amount to borrow via flash loan (e.g., 10 USDT)
        uint256 minHealthFactor; // Minimum acceptable health factor (e.g., 1.5e18)
        uint256 maxSlippage; // Max slippage in basis points (e.g., 100 = 1%)
    }

    /// @notice Emitted when a rebalance is successfully executed
    event RebalanceExecuted(
        address indexed owner,
        uint256 healthFactorBefore,
        uint256 healthFactorAfter,
        uint256 collateralWithdrawn,
        uint256 debtRepaid,
        uint256 excessReturned
    );

    /// @notice Emitted when a flash loan is executed
    event FlashLoanExecuted(address indexed asset, uint256 amount, uint256 premium);

    /// @notice Errors
    error InvalidAddress();
    error PositionHealthy();
    error InsufficientCollateral();
    error SwapOutputInsufficient();
    error HealthFactorNotImproved();
    error UnauthorizedFlashLoan();

    constructor() FlashLoanSimpleReceiverBase(IPoolAddressesProvider(POOL_ADDRESS_PROVIDER)) { }

    /// @notice Execute rebalancing of an Aave position via flash loan
    /// @dev Called by TapThatXProtocol after chip authorization validation
    /// @param owner The position owner (must have approved aToken spending)
    /// @param config Rebalancing parameters
    function executeRebalance(address owner, RebalanceConfig calldata config) external nonReentrant {
        if (owner == address(0)) revert InvalidAddress();
        if (config.collateralAsset == address(0) || config.debtAsset == address(0)) revert InvalidAddress();

        // Get current health factor
        (, , , , , uint256 healthFactorBefore) = POOL.getUserAccountData(owner);

        // Validate position needs rebalancing
        if (healthFactorBefore >= config.minHealthFactor) revert PositionHealthy();

        // Encode params for flash loan callback
        bytes memory params = abi.encode(owner, config, healthFactorBefore);

        // Initiate flash loan
        POOL.flashLoanSimple(address(this), config.debtAsset, config.flashLoanAmount, params, 0);
    }

    /// @notice Flash loan callback - executes atomic rebalancing
    /// @dev Called by Aave Pool during flash loan execution
    /// @param asset The borrowed asset address
    /// @param amount The borrowed amount
    /// @param premium The flash loan fee (0.05% = 0.0005)
    /// @param initiator The address that initiated the flash loan
    /// @param params Encoded parameters (owner, config, healthFactorBefore)
    /// @return bool True if successful (Aave auto-pulls repayment)
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        // Security: only accept flash loans we initiated
        if (msg.sender != address(POOL)) revert UnauthorizedFlashLoan();
        if (initiator != address(this)) revert UnauthorizedFlashLoan();

        emit FlashLoanExecuted(asset, amount, premium);

        // Decode params
        (address owner, RebalanceConfig memory config, uint256 healthFactorBefore) =
            abi.decode(params, (address, RebalanceConfig, uint256));

        // Step 1: Repay user's debt using flash loan
        IERC20(config.debtAsset).approve(address(POOL), amount);
        POOL.repay(config.debtAsset, amount, 2, owner); // 2 = variable rate

        // Step 2: Calculate and withdraw freed collateral
        uint256 totalRepayment = amount + premium;
        uint256 collateralToWithdraw = _calculateCollateralAmount(config, totalRepayment);

        if (collateralToWithdraw == 0) revert InsufficientCollateral();

        // Get aToken address
        DataTypes.ReserveData memory reserveData = POOL.getReserveData(config.collateralAsset);
        address aToken = reserveData.aTokenAddress;

        // Transfer aToken from user to this contract
        IERC20(aToken).transferFrom(owner, address(this), collateralToWithdraw);

        // Burn aToken to receive underlying collateral
        POOL.withdraw(config.collateralAsset, collateralToWithdraw, address(this));

        // Step 3: Swap collateral → debt asset on Uniswap V2
        uint256 swapOutput = _swapV2(config.collateralAsset, config.debtAsset, collateralToWithdraw, totalRepayment);

        // Validate swap output covers flash loan repayment
        if (swapOutput < totalRepayment) revert SwapOutputInsufficient();

        // Step 4: Approve Aave to pull flash loan repayment
        IERC20(config.debtAsset).approve(address(POOL), totalRepayment);

        // Step 5: Transfer excess to user (if any)
        uint256 excess = swapOutput - totalRepayment;
        if (excess > 0) {
            IERC20(config.debtAsset).transfer(owner, excess);
        }

        // Step 6: Validate health factor improvement
        (, , , , , uint256 healthFactorAfter) = POOL.getUserAccountData(owner);
        if (healthFactorAfter <= healthFactorBefore) revert HealthFactorNotImproved();

        emit RebalanceExecuted(owner, healthFactorBefore, healthFactorAfter, collateralToWithdraw, amount, excess);

        return true; // Aave automatically pulls totalRepayment
    }

    /// @notice Calculate exact collateral amount needed to cover flash loan repayment
    /// @dev Uses reverse Uniswap V2 calculation with slippage buffer
    /// @param config Rebalancing configuration
    /// @param totalRepayment Flash loan amount + premium
    /// @return uint256 Collateral amount needed (with slippage buffer)
    function _calculateCollateralAmount(RebalanceConfig memory config, uint256 totalRepayment)
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

        // Add slippage buffer (e.g., 1% = 100 basis points)
        uint256 slippageMultiplier = 10000 + config.maxSlippage;
        uint256 amountInWithSlippage = (amountIn * slippageMultiplier) / 10000;

        return amountInWithSlippage;
    }

    /// @notice Swap collateral for debt asset on Uniswap V2
    /// @param tokenIn Collateral asset (WETH)
    /// @param tokenOut Debt asset (USDT)
    /// @param amountIn Amount of collateral to swap
    /// @param minAmountOut Minimum output required (flash loan repayment)
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

    /// @notice Preview potential rebalancing outcome (view function)
    /// @param owner Position owner
    /// @param config Rebalancing configuration
    /// @return currentHealthFactor Current health factor
    /// @return needsRebalancing Whether position is below threshold
    /// @return estimatedCollateralNeeded Estimated collateral to withdraw
    function previewRebalance(address owner, RebalanceConfig calldata config)
        external
        view
        returns (uint256 currentHealthFactor, bool needsRebalancing, uint256 estimatedCollateralNeeded)
    {
        (, , , , , currentHealthFactor) = POOL.getUserAccountData(owner);
        needsRebalancing = currentHealthFactor < config.minHealthFactor;

        if (needsRebalancing) {
            uint256 totalRepayment = config.flashLoanAmount + (config.flashLoanAmount * 5) / 10000; // 0.05% premium
            estimatedCollateralNeeded = _calculateCollateralAmount(config, totalRepayment);
        }
    }
}

/// @notice Uniswap V2 Router interface
interface IUniswapV2Router02 {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

/// @notice Uniswap V2 Factory interface
interface IUniswapV2Factory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}

/// @notice Uniswap V2 Pair interface
interface IUniswapV2Pair {
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function token0() external view returns (address);
}
