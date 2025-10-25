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

/// @title TapThatXAaveRebalancer
/// @notice Flash loan-based Aave position rebalancer for NFC chip authorization
/// @dev Integrates with TapThatX protocol - chip auth validated before calling
contract TapThatXAaveRebalancer is ReentrancyGuard {
    /// @notice Aave V3 Pool
    IPool public immutable POOL;

    /// @notice TapThatX Protocol address (authorized caller)
    address public immutable TAPTHATX_PROTOCOL;

    /// @notice Base Sepolia Uniswap V2 Router
    address private constant UNISWAP_V2_ROUTER = 0x1689E7B1F10000AE47eBfE339a4f69dECd19F602;

    /// @notice Base Sepolia Uniswap V2 Factory
    address private constant UNISWAP_V2_FACTORY = 0x7Ae58f10f7849cA6F5fB71b7f45CB416c9204b1e;

    /// @notice Configuration for a rebalancing operation
    struct RebalanceConfig {
        address collateralAsset;
        address debtAsset;
        uint256 targetHealthFactor;
        uint256 maxSlippage;
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
    error InsufficientApproval();
    error Unauthorized();

    /// @notice Constructor accepting Aave Pool and TapThatX Protocol addresses
    /// @param poolAddress Address of the Aave V3 Pool contract
    /// @param protocolAddress Address of the TapThatX Protocol contract
    constructor(address poolAddress, address protocolAddress) {
        if (poolAddress == address(0) || protocolAddress == address(0)) revert InvalidAddress();
        POOL = IPool(poolAddress);
        TAPTHATX_PROTOCOL = protocolAddress;
    }

    /// @notice Calculate optimal flash loan amount to reach target health factor
    /// @dev Uses formula: debtRepaid = (targetHF × totalDebt - totalCollateral × LT) / (targetHF - costFactor × LT)
    /// @param owner Position owner address
    /// @param config Rebalancing configuration
    /// @return flashLoanAmount Amount of debt asset to borrow via flash loan
    function calculateOptimalFlashLoan(address owner, RebalanceConfig memory config)
        public
        view
        returns (uint256 flashLoanAmount)
    {
        (
            uint256 totalCollateralBase,
            uint256 totalDebtBase,
            ,
            uint256 currentLiquidationThreshold,
            ,
            uint256 healthFactor
        ) = POOL.getUserAccountData(owner);

        if (healthFactor >= config.targetHealthFactor) {
            return 0;
        }

        uint256 costFactorBps = 10000 + 9 + 30 + config.maxSlippage;

        uint256 totalCollateral18 = totalCollateralBase * 1e10;
        uint256 totalDebt18 = totalDebtBase * 1e10;
        uint256 lt18 = (currentLiquidationThreshold * 1e18) / 10000;
        uint256 costFactor18 = (costFactorBps * 1e18) / 10000;

        uint256 term1 = (config.targetHealthFactor * totalDebt18) / 1e18;
        uint256 term2 = (totalCollateral18 * lt18) / 1e18;

        if (term1 <= term2) {
            revert InsufficientCollateral();
        }

        uint256 numerator = term1 - term2;

        uint256 term3 = (costFactor18 * lt18) / 1e18;

        if (config.targetHealthFactor <= term3) {
            revert InsufficientCollateral();
        }

        uint256 denominator = config.targetHealthFactor - term3;

        uint256 debtRepaidUSD18 = (numerator * 1e18) / denominator;
        uint256 debtRepaidUSD = debtRepaidUSD18 / 1e10;

        address oracle = IPoolAddressesProvider(POOL.ADDRESSES_PROVIDER()).getPriceOracle();
        uint256 debtAssetPrice = IAaveOracle(oracle).getAssetPrice(config.debtAsset);
        uint256 debtDecimals = IERC20Metadata(config.debtAsset).decimals();

        flashLoanAmount = (debtRepaidUSD * (10 ** debtDecimals)) / debtAssetPrice;

        return flashLoanAmount;
    }

    /// @notice Execute rebalancing of an Aave position via flash loan
    /// @dev Called by TapThatXProtocol after chip authorization validation
    /// @param owner The position owner (must have approved aToken spending)
    /// @param config Rebalancing parameters
    function executeRebalance(address owner, RebalanceConfig calldata config) external nonReentrant {
        // Access control: only protocol or position owner can execute
        if (msg.sender != TAPTHATX_PROTOCOL && msg.sender != owner) revert Unauthorized();

        if (owner == address(0)) revert InvalidAddress();
        if (config.collateralAsset == address(0) || config.debtAsset == address(0)) revert InvalidAddress();

        // Get current health factor
        (, , , , , uint256 healthFactorBefore) = POOL.getUserAccountData(owner);

        // Validate position needs rebalancing
        if (healthFactorBefore >= config.targetHealthFactor) revert PositionHealthy();

        // Calculate optimal flash loan amount automatically
        uint256 flashLoanAmount = calculateOptimalFlashLoan(owner, config);

        if (flashLoanAmount == 0) revert PositionHealthy();

        // Encode params for flash loan callback
        bytes memory params = abi.encode(owner, config, healthFactorBefore);

        // Initiate flash loan with calculated amount
        POOL.flashLoanSimple(address(this), config.debtAsset, flashLoanAmount, params, 0);
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
    ) external returns (bool) {
        if (msg.sender != address(POOL)) revert UnauthorizedFlashLoan();
        if (initiator != address(this)) revert UnauthorizedFlashLoan();

        emit FlashLoanExecuted(asset, amount, premium);

        (address owner, RebalanceConfig memory config, uint256 healthFactorBefore) =
            abi.decode(params, (address, RebalanceConfig, uint256));

        IERC20(config.debtAsset).approve(address(POOL), amount);
        POOL.repay(config.debtAsset, amount, 2, owner);

        uint256 totalRepayment = amount + premium;
        uint256 collateralToWithdraw = _calculateCollateralAmount(config, totalRepayment);

        if (collateralToWithdraw == 0) revert InsufficientCollateral();

        DataTypes.ReserveData memory reserveData = POOL.getReserveData(config.collateralAsset);
        address aToken = reserveData.aTokenAddress;

        IERC20(aToken).transferFrom(owner, address(this), collateralToWithdraw);
        POOL.withdraw(config.collateralAsset, collateralToWithdraw, address(this));

        uint256 swapOutput = _swapV2(config.collateralAsset, config.debtAsset, collateralToWithdraw, totalRepayment);

        if (swapOutput < totalRepayment) revert SwapOutputInsufficient();

        IERC20(config.debtAsset).approve(address(POOL), totalRepayment);

        uint256 excess = swapOutput - totalRepayment;
        if (excess > 0) {
            IERC20(config.debtAsset).transfer(owner, excess);
        }

        (, , , , , uint256 healthFactorAfter) = POOL.getUserAccountData(owner);
        if (healthFactorAfter <= healthFactorBefore) revert HealthFactorNotImproved();

        emit RebalanceExecuted(owner, healthFactorBefore, healthFactorAfter, collateralToWithdraw, amount, excess);

        return true;
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
        address pair = _getPair(config.collateralAsset, config.debtAsset);
        if (pair == address(0)) return 0;

        (uint112 reserve0, uint112 reserve1,) = IUniswapV2Pair(pair).getReserves();
        address token0 = IUniswapV2Pair(pair).token0();

        (uint112 reserveCollateral, uint112 reserveDebt) = token0 == config.collateralAsset
            ? (reserve0, reserve1)
            : (reserve1, reserve0);

        uint256 numerator = uint256(reserveCollateral) * totalRepayment * 1000;
        uint256 denominator = (uint256(reserveDebt) - totalRepayment) * 997;
        uint256 amountIn = (numerator / denominator) + 1;

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
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        IERC20(tokenIn).approve(UNISWAP_V2_ROUTER, amountIn);

        uint256[] memory amounts = IUniswapV2Router02(UNISWAP_V2_ROUTER).swapExactTokensForTokens(
            amountIn, minAmountOut, path, address(this), block.timestamp
        );

        return amounts[1];
    }

    /// @notice Get Uniswap V2 pair address
    /// @param tokenA First token
    /// @param tokenB Second token
    /// @return address Pair address
    function _getPair(address tokenA, address tokenB) internal view returns (address) {
        return IUniswapV2Factory(UNISWAP_V2_FACTORY).getPair(tokenA, tokenB);
    }

    /// @notice Preview potential rebalancing outcome
    /// @param owner Position owner
    /// @param config Rebalancing configuration
    /// @return currentHealthFactor Current health factor
    /// @return needsRebalancing Whether position is below threshold
    /// @return estimatedFlashLoanAmount Calculated flash loan amount needed
    /// @return estimatedCollateralNeeded Estimated collateral to withdraw
    function previewRebalance(address owner, RebalanceConfig calldata config)
        external
        view
        returns (
            uint256 currentHealthFactor,
            bool needsRebalancing,
            uint256 estimatedFlashLoanAmount,
            uint256 estimatedCollateralNeeded
        )
    {
        (, , , , , currentHealthFactor) = POOL.getUserAccountData(owner);
        needsRebalancing = currentHealthFactor < config.targetHealthFactor;

        if (needsRebalancing) {
            estimatedFlashLoanAmount = calculateOptimalFlashLoan(owner, config);
            uint256 totalRepayment = estimatedFlashLoanAmount + (estimatedFlashLoanAmount * 9) / 10000;
            estimatedCollateralNeeded = _calculateCollateralAmount(config, totalRepayment);
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
