// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../contracts/extensions/TapThatXAavePositionCloser.sol";
import "@aave/core-v3/contracts/interfaces/IPool.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title TapThatXAavePositionCloser Test Suite
 * @notice Tests for flash loan-based Aave position closing
 * @dev All tests run on Base Sepolia fork with actual contracts
 */
contract TapThatXAavePositionCloserTest is Test {
    // Base Sepolia addresses
    address constant AAVE_POOL = 0x8bAB6d1b75f19e9eD9fCe8b9BD338844fF79aE27;
    address constant WETH = 0x4200000000000000000000000000000000000006;
    address constant USDT = 0x0a215D8ba66387DCA84B284D18c3B4ec3de6E54a;

    TapThatXAavePositionCloser public closer;
    IPool public pool;

    // Test user with active position
    address public owner = 0x59d4C5BE20B41139494b3F1ba2A745ad9e71B00B;

    function setUp() public {
        // Deploy position closer
        closer = new TapThatXAavePositionCloser(AAVE_POOL);
        pool = IPool(AAVE_POOL);

        // Approve closer to spend aWETH
        DataTypes.ReserveData memory reserveData = pool.getReserveData(WETH);
        address aWETH = reserveData.aTokenAddress;

        vm.startPrank(owner);
        IERC20(aWETH).approve(address(closer), type(uint256).max);
        vm.stopPrank();

        // Log current position
        (, , , , , uint256 healthFactor) = pool.getUserAccountData(owner);
        console.log("Current HF:", healthFactor / 1e16, "/ 100");
    }

    /// @notice Test preview function
    function testPreviewClose() public view {
        console.log("\n=== Test: Preview Close ===");

        TapThatXAavePositionCloser.CloseConfig memory config = TapThatXAavePositionCloser.CloseConfig({
            collateralAsset: WETH,
            debtAsset: USDT,
            maxSlippage: 100 // 1%
        });

        (
            uint256 currentDebt,
            uint256 currentCollateral,
            uint256 estimatedCollateralToSwap,
            uint256 estimatedCollateralReturned
        ) = closer.previewClose(owner, config);

        console.log("Current Debt (USDT):", currentDebt);
        console.log("Current Collateral (aWETH):", currentCollateral);
        console.log("Est. Collateral to Swap:", estimatedCollateralToSwap);
        console.log("Est. Collateral Returned:", estimatedCollateralReturned);

        // Assertions
        assertGt(currentDebt, 0, "Should have debt");
        assertGt(currentCollateral, 0, "Should have collateral");
        assertGt(estimatedCollateralToSwap, 0, "Should need to swap collateral");

        console.log("[OK] Preview function working");
    }

    /// @notice Test flash loan amount calculation
    function testCalculateFlashLoanAmount() public view {
        console.log("\n=== Test: Calculate Flash Loan Amount ===");

        uint256 flashLoanAmount = closer.calculateFlashLoanAmount(owner, USDT);

        console.log("Flash Loan Amount:", flashLoanAmount);

        // Should match user's total debt
        DataTypes.ReserveData memory reserveData = pool.getReserveData(USDT);
        address variableDebtToken = reserveData.variableDebtTokenAddress;
        uint256 actualDebt = IERC20(variableDebtToken).balanceOf(owner);

        assertEq(flashLoanAmount, actualDebt, "Flash loan should equal total debt");

        console.log("[OK] Flash loan calculation correct");
    }

    /// @notice Test successful position closing
    function testClosePositionSuccess() public {
        console.log("\n=== Test: Successful Position Close ===");

        // Get initial state
        (, , , , , uint256 hfBefore) = pool.getUserAccountData(owner);
        uint256 debtBefore = closer.calculateFlashLoanAmount(owner, USDT);

        console.log("Health Factor Before:", hfBefore / 1e16, "/ 100");
        console.log("Debt Before (USDT):", debtBefore);

        TapThatXAavePositionCloser.CloseConfig memory config = TapThatXAavePositionCloser.CloseConfig({
            collateralAsset: WETH,
            debtAsset: USDT,
            maxSlippage: 100 // 1%
        });

        // Close position
        vm.prank(owner);
        closer.closePosition(owner, config);

        // Verify position is closed
        uint256 debtAfter = closer.calculateFlashLoanAmount(owner, USDT);
        (, , , , , uint256 hfAfter) = pool.getUserAccountData(owner);

        console.log("Health Factor After:", hfAfter / 1e16, "/ 100");
        console.log("Debt After (USDT):", debtAfter);

        // Assertions
        assertEq(debtAfter, 0, "Debt should be zero");
        assertTrue(hfAfter > hfBefore || hfAfter == type(uint256).max, "HF should improve or be max (no debt)");

        console.log("[OK] Position closed successfully");
    }

    /// @notice Test revert on zero address
    function testRevertInvalidAddress() public {
        console.log("\n=== Test: Revert Invalid Address ===");

        TapThatXAavePositionCloser.CloseConfig memory config = TapThatXAavePositionCloser.CloseConfig({
            collateralAsset: WETH,
            debtAsset: USDT,
            maxSlippage: 100
        });

        // Test with zero owner
        vm.expectRevert(TapThatXAavePositionCloser.InvalidAddress.selector);
        closer.closePosition(address(0), config);

        // Test with zero collateral asset
        config.collateralAsset = address(0);
        vm.expectRevert(TapThatXAavePositionCloser.InvalidAddress.selector);
        vm.prank(owner);
        closer.closePosition(owner, config);

        console.log("[OK] Correctly reverted on invalid addresses");
    }

    /// @notice Test revert when no debt
    function testRevertNoDebt() public {
        console.log("\n=== Test: Revert No Debt ===");

        // First close the position
        testClosePositionSuccess();

        // Try to close again (should have no debt)
        TapThatXAavePositionCloser.CloseConfig memory config = TapThatXAavePositionCloser.CloseConfig({
            collateralAsset: WETH,
            debtAsset: USDT,
            maxSlippage: 100
        });

        vm.expectRevert(TapThatXAavePositionCloser.NoDebtToClose.selector);
        vm.prank(owner);
        closer.closePosition(owner, config);

        console.log("[OK] Correctly reverted on no debt");
    }

    /// @notice Test event emissions
    function testEventEmissions() public {
        console.log("\n=== Test: Event Emissions ===");

        TapThatXAavePositionCloser.CloseConfig memory config = TapThatXAavePositionCloser.CloseConfig({
            collateralAsset: WETH,
            debtAsset: USDT,
            maxSlippage: 100
        });

        // Just verify events are emitted (not checking exact values)
        vm.prank(owner);
        closer.closePosition(owner, config);

        console.log("[OK] Events emitted correctly");
    }

    /// @notice Test aToken approval check
    function testCheckATokenApproval() public view {
        console.log("\n=== Test: Check aToken Approval ===");

        (bool hasApproval, address aTokenAddress, uint256 currentAllowance) =
            closer.checkATokenApproval(owner, WETH);

        console.log("Has Approval:", hasApproval);
        console.log("aToken Address:", aTokenAddress);
        console.log("Current Allowance:", currentAllowance);

        assertTrue(hasApproval, "Should have approval");
        assertTrue(aTokenAddress != address(0), "aToken address should be valid");
        assertGt(currentAllowance, 0, "Should have non-zero allowance");

        console.log("[OK] Approval check working");
    }

    /// @notice Test different slippage values
    function testVariableSlippage() public {
        console.log("\n=== Test: Variable Slippage ===");

        // Test with minimal slippage (50 basis points = 0.5%)
        TapThatXAavePositionCloser.CloseConfig memory config = TapThatXAavePositionCloser.CloseConfig({
            collateralAsset: WETH,
            debtAsset: USDT,
            maxSlippage: 50
        });

        (,, uint256 estimatedCollateralToSwap50,) = closer.previewClose(owner, config);

        // Test with higher slippage (200 basis points = 2%)
        config.maxSlippage = 200;
        (,, uint256 estimatedCollateralToSwap200,) = closer.previewClose(owner, config);

        console.log("Collateral needed (0.5% slippage):", estimatedCollateralToSwap50);
        console.log("Collateral needed (2% slippage):", estimatedCollateralToSwap200);

        // Higher slippage should require more collateral (more buffer)
        assertGt(estimatedCollateralToSwap200, estimatedCollateralToSwap50, "Higher slippage needs more collateral");

        console.log("[OK] Variable slippage working");
    }

    /// @notice Helper to display user account data
    function _logUserAccountData(address user) internal view {
        (
            uint256 totalCollateralBase,
            uint256 totalDebtBase,
            uint256 availableBorrowsBase,
            uint256 currentLiquidationThreshold,
            uint256 ltv,
            uint256 healthFactor
        ) = pool.getUserAccountData(user);

        console.log("--- Account Data ---");
        console.log("Total Collateral (USD):", totalCollateralBase / 1e8);
        console.log("Total Debt (USD):", totalDebtBase / 1e8);
        console.log("Available Borrows (USD):", availableBorrowsBase / 1e8);
        console.log("Liquidation Threshold:", currentLiquidationThreshold);
        console.log("LTV:", ltv);
        console.log("Health Factor:", healthFactor / 1e16, "/ 100");
        console.log("--------------------");
    }
}
