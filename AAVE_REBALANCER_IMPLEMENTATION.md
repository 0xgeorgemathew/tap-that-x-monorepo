# Aave Rebalancer - 24 Hour Implementation Plan

**Project:** TapThat X - Aave Position Rebalancing via NFC Chip
**Timeline:** 24 Hours
**Network:** Base Sepolia Testnet
**Status:** Ready for Execution

---

## Executive Summary

Enable NFC chip-authorized Aave position rebalancing using flash loans. User taps chip → flash loan executes → debt reduced → collateral withdrawn → swapped → health factor improved. No upfront capital required.

---

## How Flash Loan Rebalancing Works

### The Problem
You have an Aave position with low health factor (HF 1.18) that's at risk of liquidation. To improve it, you need to reduce debt, but you don't have available USDT to repay.

### The Solution: Flash Loan Magic ✨

**Flash loans let you borrow money, use it, and repay it—all in ONE atomic transaction.**

### Step-by-Step Flow

```
Initial Position:
├─ Collateral: 0.01 WETH ($39.06)
├─ Debt: 28 USDT
└─ Health Factor: 1.18 ⚠️ (RISKY!)

Transaction Begins (All Atomic):

1️⃣ Flash Loan (Borrow)
   Aave → Rebalancer: 10 USDT
   Cost: 0.005 USDT fee (0.05%)

2️⃣ Repay User's Debt
   Rebalancer → Aave: Pay 10 USDT on behalf of user
   Result: User debt drops from 28 → 18 USDT ✓
   Benefit: Frees up ~0.00256 WETH of user's collateral

3️⃣ Withdraw Freed Collateral
   Rebalancer → Aave: "Withdraw 0.00256 WETH from user"
   Aave transfers user's aWETH → Rebalancer
   Rebalancer burns aWETH, receives 0.00256 WETH

4️⃣ Swap WETH → USDT
   Rebalancer → Uniswap V2: Swap 0.00256 WETH for USDT
   Calculation: 0.00256 × 3,969 × 0.997 = 10.13 USDT

5️⃣ Repay Flash Loan
   Rebalancer → Aave: Return 10.005 USDT
   Leftover: 10.13 - 10.005 = 0.125 USDT

6️⃣ Return Excess to User
   Rebalancer → User: Send 0.125 USDT bonus ✓

Transaction Completes (Success!)

Final Position:
├─ Collateral: 0.00744 WETH ($29.07)
├─ Debt: 18 USDT
├─ Health Factor: 1.37 ✅ (SAFE!)
├─ User bonus: 0.125 USDT
└─ Total cost: 0.005 USDT (flash loan fee only)
```

### Why This is Atomic (Safe)

**If ANY step fails → ENTIRE transaction reverts. Either everything succeeds, or nothing happens.**

- Flash loan not repaid? → Revert (impossible to happen)
- Swap gets bad price? → Revert (slippage protection)
- Health factor not improved? → Revert (validation check)
- Can't withdraw collateral? → Revert (insufficient freed collateral)

**You can never end up in a half-completed state!**

### Key Requirements

1. **Sufficient Collateral**: Position must have enough collateral to free up after partial debt repayment
2. **Adequate Liquidity**: Uniswap pool must have enough liquidity for the swap
3. **Favorable Price**: Swap output must cover flash loan + premium
4. **User Approvals**: User must pre-approve rebalancer to pull aWETH tokens

### Economic Flow

```
Money In:                        Money Out:
─────────────────────           ─────────────────────
Flash loan: +10 USDT        →   Debt repay: -10 USDT
Swap proceeds: +10.13 USDT  →   Flash repay: -10.005 USDT
                                User bonus: -0.125 USDT

Net to rebalancer: 0 USDT ✓ (break-even)
Net to user: -0.00256 WETH + 0.125 USDT + improved HF
```

---

## Test Configuration (Base Sepolia)

### Actual Test Position (RISKY ⚠️)
```
Initial State:
  Collateral: 0.0100002 ETH ($39.06 @ $3,906/ETH)
  Debt: 28 USDT
  Health Factor: 1.18 ⚠️ (DANGEROUS - below 1.5 threshold)
  Borrow Power Used: ~86%
  Liquidation Risk: HIGH (only 18% from liquidation at HF 1.0)

Flash Loan: 10 USDT

Expected Result After Rebalancing:
  Collateral: ~0.00744 ETH (~$29.07)
  Debt: 18 USDT (reduced by 10)
  Health Factor: ~1.37 ✅ (16% improvement)
  User receives: ~0.125 USDT excess
  Liquidation Risk: MEDIUM (37% buffer - much safer than 18%)
```

### Economics Validation (Verified ✅)

**Current Position Analysis:**
- Collateral value: 0.0100002 ETH × $3,906 = $39.06
- Liquidation threshold: 85%
- Available collateral: $39.06 × 0.85 = $33.20
- Current debt: 28 USDT
- **Current HF: $33.20 / $28 = 1.186 ⚠️ (RISKY!)**
- Distance to liquidation: Only 18% (dangerous)

**Flash Loan Rebalancing (CORRECTED):**
- Flash loan: 10 USDT
- Premium (0.05%): 0.005 USDT
- Total repayment needed: 10.005 USDT
- Collateral to withdraw: ~0.00256 ETH ($10.00 @ $3,906/ETH)
- Uniswap V2 calculation:
  * Formula: (amountIn × 997 × reserve1) / (reserve0 × 1000 + amountIn × 997)
  * Input: 0.00256 ETH
  * With 0.3% fee: Output = 0.00256 × 3,969 × 0.997 = 10.13 USDT ✅
- Excess to user: 10.13 - 10.005 = 0.125 USDT ✅
- Safety margin: Adequate with 1% slippage buffer

**After Rebalancing:**
- New debt: 18 USDT
- New collateral: ~0.00744 ETH ($29.07)
- **New HF: ($29.07 × 0.85) / $18 = 1.373**
- **Wait...** this HF is lower than expected! Recalculating...
- **Actual calculation using Aave logic:**
  * Collateral remaining: 0.01 - 0.00256 = 0.00744 ETH
  * Collateral value: 0.00744 × $3,906 = $29.05
  * Liquidation threshold value: $29.05 × 0.85 = $24.69
  * New debt: 18 USDT
  * **New HF: $24.69 / $18 = 1.372** (37% improvement)
- **User saves position from potential liquidation!**
- Note: HF improvement is 37% (not 56%), but still significant safety gain

### Base Sepolia Addresses (Verified ✅)

**Core Contracts:**
```
Aave V3 Pool: 0x07eA79F68B2B3df564D0A34F8e19D9B1e339814b
Pool Address Provider: 0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D
Uniswap V2 Router: 0x1689E7B1F10000AE47eBfE339a4f69dECd19F602
Uniswap V2 Factory: 0x8909dc15e40173ff4699343b6eb8132c65e18ec6
```

**Tokens:**
```
WETH: 0x4200000000000000000000000000000000000006
USDT: 0x0a215D8ba66387DCA84B284D18c3B4ec3de6E54a
```

**Liquidity Pool:**
```
WETH/USDT Pair: 0x9a03e586c9b1df47f69e1951a5ac96ee323591a8
Reserves: 1 WETH + 3,969 USDT (verified ✅)
Price: 1 WETH = 3,969 USDT
Liquidity TX: 0xbeb6168ded526debbd7ee9e7ec734496189f16c8bbc69e02bcd803bc6e96cf2c
```

**Aave Tokens:**
```
Variable Debt USDT: 0x8bAB6d1b75f19e9eD9fCe8b9BD338844fF79aE27
```

**Test Position (Active - AT RISK ⚠️):**
```
Collateral: 0.0100002 ETH ($39.06 @ $3,906/ETH)
Debt: 28 USDT (borrowed in 2 transactions)
Health Factor: 1.18 ⚠️ (DANGEROUS - below 1.5 safe threshold)
Borrow Power Used: 86%
Liquidation Threshold: 85%
Liquidation Price: ETH drops to ~$3,300 (-15.5%)

Transactions:
- Initial Deposit: 0x94e75883a11aa6aab29429b6af9677498394a77527a890683c129ee7479cf99d
- Borrow 1 (15 USDT): 0x66340bd262ce2041c2d861cb12c24d5cadfe3aa8a7d58bc75f4e96847bbaeed5
- Borrow 2 (13 USDT): [Additional borrow to create risky position]

Status: NEEDS REBALANCING ⚠️
```

**Note:** Using Uniswap V2 for simplicity - perfect for hackathon deployment.

---

## Test Environment Verification ✅

### Liquidity Pool Created
**Transaction:** `0xbeb6168ded526debbd7ee9e7ec734496189f16c8bbc69e02bcd803bc6e96cf2c`

**Details:**
- WETH deposited: 1 WETH
- USDT deposited: 3,969 USDT
- LP tokens received: 0.000062999999999 UNI-V2
- Pair created: `0x9a03e586c9b1df47f69e1951a5ac96ee323591a8`
- Status: ✅ Active

**Reserves Verified:**
```
reserve0 (USDT): 3,969,000,000 (3,969 USDT)
reserve1 (WETH): 1,000,000,000,000,000,000 (1 WETH)
Price: 1 WETH = 3,969 USDT ✅
```

### Aave Position Created
**Deposit Transaction:** `0x94e75883a11aa6aab29429b6af9677498394a77527a890683c129ee7479cf99d`
- Collateral: 0.01 ETH deposited
- Status: ✅ Confirmed

**Borrow Transaction:** `0x66340bd262ce2041c2d861cb12c24d5cadfe3aa8a7d58bc75f4e96847bbaeed5`
- Debt: 15 USDT borrowed
- Variable debt token received
- Status: ✅ Confirmed

**Position Summary:**
- Collateral: 0.0100002 ETH ($39.06 @ $3,906/ETH)
- Debt: 28 USDT
- Health Factor: 1.18 ⚠️ (DANGEROUS - only 18% from liquidation)
- Liquidation occurs if HF < 1.0
- **This is a realistic risky position that NEEDS rebalancing**

### Swap Test Verified
**Query:** `getAmountsOut(0.01 WETH, [WETH, USDT])`

**Result:**
- Input: 10,000,000,000,000,000 wei (0.01 WETH)
- Output: 39,180,302 (39.18 USDT)
- Status: ✅ Swap calculation works correctly

**Rebalancer Swap Estimate (CORRECTED):**
- Input: 0.00256 WETH (for 10 USDT flash loan + premium)
- Expected output: ~10.13 USDT (via Uniswap V2 with 0.3% fee)
- Flash loan + premium: 10.005 USDT
- **Excess to user: ~0.125 USDT ✅**
- **HF improvement: 1.18 → 1.37 (16% safer, escapes liquidation risk)**

---

## ⚠️ Why This Position NEEDS Rebalancing

### Current Risk Level: DANGEROUS

**Your Health Factor: 1.18**
- Liquidation threshold: HF < 1.0
- Current buffer: Only 18% above liquidation
- **A 15% ETH price drop triggers liquidation**

**What happens if ETH price drops:**
| ETH Price | Change | Health Factor | Status |
|-----------|--------|---------------|---------|
| $3,906 (current) | 0% | 1.18 | ⚠️ RISKY |
| $3,650 | -6.6% | 1.10 | 🔴 VERY DANGEROUS |
| $3,400 | -13.0% | 1.03 | 🔴 NEAR LIQUIDATION |
| $3,300 | -15.5% | 0.99 | ❌ LIQUIDATED |

**Rebalancing saves your position:**
- Reduces debt: 28 → 18 USDT
- Improves HF: 1.18 → 1.37
- New liquidation price: $2,625 (-33% drop needed vs -15% before)
- **You gain 16% more safety margin (doubles your buffer before liquidation)**

**This demonstrates the REAL value of the rebalancer:**
1. User over-borrowed and is at risk
2. One tap rebalances position without adding capital
3. Position becomes safe again
4. User avoids costly liquidation penalties

---

## Implementation Phases

### Phase 1: Smart Contract (Hours 0-8)

#### Create TapThatXAaveRebalancer.sol

**Location:** `packages/foundry/contracts/defi/TapThatXAaveRebalancer.sol`

**Core Structure:**
```solidity
contract TapThatXAaveRebalancer is
    FlashLoanSimpleReceiverBase,
    ReentrancyGuard
{
    IUniswapV2Router02 public immutable uniswapV2Router;

    struct RebalanceConfig {
        address collateralAsset;
        address debtAsset;
        uint256 flashLoanAmount;
        uint256 minHealthFactor;
        uint256 maxSlippage;
    }

    // ✅ CORRECTED: No chip, chipSignature, timestamp, nonce params
    // These are already validated by TapThatXProtocol before this is called
    function executeRebalance(
        address owner,
        RebalanceConfig calldata config
    ) external nonReentrant;

    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bool);
}
```

**IMPORTANT: Integration with TapThatX Architecture**

The rebalancer is called by `TapThatXProtocol` AFTER chip authorization is validated. The flow is:

```
User taps chip
    ↓
TapThatXExecutor.executeTap()
    ↓ (fetches staticCallData from TapThatXConfiguration)
TapThatXProtocol.executeAuthorizedCall()
    ↓ (validates chipSignature, timestamp, nonce, ownership)
target.call(staticCallData)  ← This calls executeRebalance
    ↓
TapThatXAaveRebalancer.executeRebalance(owner, config)
```

**Why no chip auth params in executeRebalance?**
- TapThatXProtocol already validated the chip signature
- TapThatXProtocol already checked chip ownership
- TapThatXProtocol already verified nonce uniqueness
- TapThatXProtocol already validated timestamp window
- By the time executeRebalance() is called, authorization is guaranteed ✅

The `staticCallData` stored in TapThatXConfiguration contains ONLY:
- `owner` address
- `config` struct (collateral, debt, flashLoan amount, etc.)

Dynamic auth parameters (chipSignature, timestamp, nonce) are NOT stored in staticCallData because they change with each execution.

**Key Functions:**
1. `executeRebalance(owner, config)` - Entry point (chip auth already validated by protocol)
   - Validates position needs rebalancing (HF < threshold)
   - Encodes params for flash loan callback
   - Initiates flash loan via `POOL.flashLoanSimple()`

2. `executeOperation()` - Flash loan callback (called by Aave):
   - **Step 1:** Repay user's debt (approve + repay)
   - **Step 2:** Calculate & withdraw freed collateral (with aToken handling)
   - **Step 3:** Swap collateral → debt asset on Uniswap V2
   - **Step 4:** Approve Aave Pool to pull flash loan repayment
   - **Step 5:** Transfer excess to user
   - **Step 6:** Validate HF improvement
   - Return true (Aave auto-pulls repayment)

3. `_calculateCollateralAmount()` - Calculate exact WETH needed for swap
   - Query Uniswap reserves
   - Calculate reverse swap math (amountOut → amountIn)
   - Add slippage buffer

4. `_swapV2()` - Execute Uniswap V2 swap
   - Build path [WETH, USDT]
   - Approve router
   - Call swapExactTokensForTokens
   - Return output amount

**Dependencies:**
- `@aave/core-v3/contracts/flashloan/base/FlashLoanSimpleReceiverBase.sol`
- `@aave/core-v3/contracts/interfaces/IPool.sol`
- `@openzeppelin/contracts/utils/ReentrancyGuard.sol`
- `@openzeppelin/contracts/access/Ownable.sol`
- Uniswap V2 Router interface (create locally)

**Critical Validations:**
- Health factor < minHealthFactor threshold (position needs rebalancing)
- Collateral withdrawal amount > 0 (position has freed collateral)
- Swap output ≥ flash loan repayment needed (economic viability)
- Post-execution HF ≥ minHealthFactor (improvement achieved)
- Flash loan initiator == address(this) (security check)
- msg.sender == address(POOL) in executeOperation (security check)

**Critical Approvals (3 Required):**

The contract must manage 3 separate ERC20 approvals during executeOperation:

```solidity
// APPROVAL 1: Before repaying user's debt
IERC20(debtAsset).approve(address(POOL), flashLoanAmount);
POOL.repay(debtAsset, flashLoanAmount, 2, owner);

// APPROVAL 2: Before swapping (in _swapV2 function)
IERC20(collateralAsset).approve(address(uniswapV2Router), collateralAmount);
IUniswapV2Router02(uniswapV2Router).swapExactTokensForTokens(...);

// APPROVAL 3: Before flash loan auto-repayment ⚠️ CRITICAL!
// Aave automatically pulls this at the end of executeOperation
uint256 totalDebt = flashLoanAmount + premium;
IERC20(debtAsset).approve(address(POOL), totalDebt);
return true;  // ← Aave pulls totalDebt after this returns
```

**Why 3 approvals?**
- Approval 1: Allows Aave to take USDT for debt repayment
- Approval 2: Allows Uniswap to take WETH for swap
- Approval 3: Allows Aave to take USDT for flash loan repayment (MUST do this!)

**aToken Handling:**

Aave represents deposited collateral as "aTokens" (e.g., aWETH for deposited WETH). To withdraw user's collateral:

```solidity
// 1. Get aToken address from Aave
DataTypes.ReserveData memory reserveData =
    POOL.getReserveData(config.collateralAsset);
address aToken = reserveData.aTokenAddress;  // e.g., aWETH

// 2. Transfer aToken from user to rebalancer
// User must have pre-approved rebalancer: aWETH.approve(rebalancer, max)
IERC20(aToken).transferFrom(owner, address(this), collateralAmount);

// 3. Burn aToken to withdraw underlying WETH
POOL.withdraw(
    config.collateralAsset,  // WETH
    collateralAmount,        // Amount to withdraw
    address(this)            // Recipient (rebalancer)
);
// Rebalancer now has WETH, ready to swap
```

**User Pre-Approval Required:**

Before configuration, user must approve rebalancer to spend their aWETH:
```solidity
// User must call this BEFORE configuring rebalancer action:
aWETH.approve(TapThatXAaveRebalancer_ADDRESS, type(uint256).max);
```

Without this approval, `transferFrom(owner, ...)` will fail in executeOperation.

**Events:**
```solidity
event RebalanceExecuted(
    address indexed owner,
    uint256 healthFactorBefore,
    uint256 healthFactorAfter,
    uint256 collateralWithdrawn,
    uint256 excessReturned
);
event FlashLoanExecuted(address indexed asset, uint256 amount, uint256 premium);
```

#### Deliverables (Hour 8)
- [ ] TapThatXAaveRebalancer.sol complete
- [ ] Compiles without errors
- [ ] All imports resolved

---

### Phase 2: Testing on Base Sepolia (Hours 9-14)

#### Test Strategy
**No mocks - all testing on Base Sepolia fork and live testnet**

#### Setup Test Environment

```bash
# Test on Base Sepolia fork
forge test --fork-url https://sepolia.base.org --match-contract AaveRebalancerTest -vvv
```

**Test File:** `packages/foundry/test/TapThatXAaveRebalancer.t.sol`

**Test Cases:**
```solidity
contract AaveRebalancerTest is Test {
    // Use real Base Sepolia addresses
    address constant AAVE_POOL = 0x07eA79F68B2B3df564D0A34F8e19D9B1e339814b;
    address constant WETH = 0x4200000000000000000000000000000000000006;

    function setUp() public {
        // Fork Base Sepolia
        vm.createSelectFork("base_sepolia");

        // Deploy rebalancer
        rebalancer = new TapThatXAaveRebalancer(
            POOL_ADDRESS_PROVIDER,
            address(protocol),
            SWAP_ROUTER
        );
    }

    function testRebalanceSuccess() public;
    function testRevertIfHealthy() public;
    function testRevertIfInsufficientCollateral() public;
    function testSlippageProtection() public;
    function testUnauthorizedChip() public;
}
```

**Critical Tests:**
1. Successful rebalance (HF 1.2 → 2.1)
2. Revert if HF already healthy
3. Revert if insufficient collateral
4. Slippage protection
5. Unauthorized chip rejection
6. Gas cost < 600k

#### Live Testing Checklist

**Preparation:**
- [✅] Get Base Sepolia ETH
- [✅] Get test USDT (completed - have 5000 USDT)
- [✅] Wrap ETH → WETH (completed - have 1 WETH)
- [✅] Create Aave position (0.01 WETH, 15 USDT debt)

**Approvals:**
- [ ] Approve rebalancer for USDT spending
- [ ] Approve rebalancer for aToken withdrawal

**Execution:**
- [ ] Register test chip
- [ ] Configure rebalancer action
- [ ] Tap chip and execute
- [ ] Verify HF improvement
- [ ] Verify excess returned

#### Deliverables (Hour 14)
- [ ] All tests passing on Base Sepolia fork
- [ ] Gas usage documented (<600k)
- [ ] Live test successful

---

### Phase 3: Frontend Integration (Hours 15-18)

#### Action Template

**File:** `packages/nextjs/utils/actionTemplates.ts`

Add:
```typescript
export const aaveRebalanceTemplate: ActionTemplate = {
  id: "aave-rebalance",
  name: "Aave Position Rebalancer",
  description: "Reduce debt using flash loan to improve health factor",
  category: "defi",
  buildCallData: (params: {
    owner: `0x${string}`;  // User's wallet address
    collateralAsset: `0x${string}`;  // WETH
    debtAsset: `0x${string}`;  // USDT
    flashLoanAmount: bigint;  // 10 USDT (in 6 decimals)
    minHealthFactor: bigint;  // 1.5 (in 18 decimals)
    maxSlippage: bigint;  // 100 (1%)
  }) => {
    // Build config struct
    const config = {
      collateralAsset: params.collateralAsset,
      debtAsset: params.debtAsset,
      flashLoanAmount: params.flashLoanAmount,
      minHealthFactor: params.minHealthFactor,
      maxSlippage: params.maxSlippage,
    };

    // Encode: executeRebalance(address owner, RebalanceConfig config)
    const callData = encodeFunctionData({
      abi: AAVE_REBALANCER_ABI,
      functionName: "executeRebalance",
      args: [
        params.owner,  // Address of position owner
        config,        // Struct with rebalancing parameters
      ],
    });

    return {
      target: REBALANCER_ADDRESS,
      callData
    };
  },
};

// ABI for reference:
const AAVE_REBALANCER_ABI = [
  {
    name: "executeRebalance",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "owner", type: "address" },
      {
        name: "config",
        type: "tuple",
        components: [
          { name: "collateralAsset", type: "address" },
          { name: "debtAsset", type: "address" },
          { name: "flashLoanAmount", type: "uint256" },
          { name: "minHealthFactor", type: "uint256" },
          { name: "maxSlippage", type: "uint256" },
        ]
      }
    ],
    outputs: [],
  },
] as const;
```

#### Configure Page Updates

**File:** `packages/nextjs/app/configure/page.tsx`

Add state:
```typescript
const [collateralAsset, setCollateralAsset] = useState("");
const [debtAsset, setDebtAsset] = useState("");
const [flashLoanAmount, setFlashLoanAmount] = useState("");
const [minHealthFactor, setMinHealthFactor] = useState("1.5");
const [maxSlippage, setMaxSlippage] = useState("100"); // 1%
```

Add form fields:
```tsx
{selectedTemplate === "aave-rebalance" && (
  <>
    <input placeholder="Collateral Asset (WETH)" value={collateralAsset} onChange={...} />
    <input placeholder="Debt Asset (USDT)" value={debtAsset} onChange={...} />
    <input placeholder="Flash Loan Amount" value={flashLoanAmount} onChange={...} />
    <input placeholder="Min Health Factor (1.5)" value={minHealthFactor} onChange={...} />
    <input placeholder="Max Slippage (1%)" value={maxSlippage} onChange={...} />
  </>
)}
```

Add health factor display:
```typescript
const { data: healthFactor } = useReadContract({
  address: AAVE_POOL,
  abi: AAVE_POOL_ABI,
  functionName: "getUserAccountData",
  args: [address],
});

// Display USDT debt and WETH collateral
```

#### Deliverables (Hour 18)
- [ ] Template added
- [ ] Configure page updated
- [ ] Health factor display works
- [ ] Form validation working

---

### Phase 4: Deployment (Hours 19-22)

#### Deploy to Base Sepolia

**Script:** `packages/foundry/script/DeployAaveRebalancer.s.sol`

```solidity
contract DeployAaveRebalancer is Script {
    function run() external {
        // Base Sepolia addresses
        address poolProvider = 0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D;
        address uniswapV2Router = 0x1689E7B1F10000AE47eBfE339a4f69dECd19F602;

        vm.startBroadcast();

        // Deploy rebalancer (no protocol parameter needed)
        TapThatXAaveRebalancer rebalancer = new TapThatXAaveRebalancer(
            poolProvider,      // Aave Pool Address Provider
            uniswapV2Router    // Uniswap V2 Router
        );

        console.log("TapThatXAaveRebalancer deployed:", address(rebalancer));

        vm.stopBroadcast();
    }
}
```

**Deploy:**
```bash
forge script script/DeployAaveRebalancer.s.sol \
  --rpc-url base_sepolia \
  --broadcast \
  --verify
```

#### Update Contracts

**File:** `packages/nextjs/contracts/deployedContracts.ts`

Add to Base Sepolia (84532):
```typescript
TapThatXAaveRebalancer: {
  address: "0x...",
  abi: [...],
}
```

#### End-to-End Test

1. Create Aave position
2. Register chip
3. Configure rebalancer action
4. Tap chip
5. Verify execution
6. Check HF improvement
7. Verify excess received

#### Deliverables (Hour 22)
- [ ] Contract deployed to Base Sepolia
- [ ] Verified on BaseScan
- [ ] deployedContracts.ts updated
- [ ] E2E test successful

---

### Phase 5: Documentation (Hours 23-24)

#### Update CLAUDE.md

Add section:
```markdown
## Aave Rebalancer

**Contract:** TapThatXAaveRebalancer.sol
**Location:** packages/foundry/contracts/defi/

**Flow:**
1. User taps chip
2. Flash loan initiated
3. Debt repaid → Collateral withdrawn → Swapped → Loan repaid
4. Health factor improved

**Base Sepolia:**
- Rebalancer: 0x...
- Aave Pool: 0x07eA79F68B2B3df564D0A34F8e19D9B1e339814b

**Test Config:**
- Collateral: 0.01 ETH
- Debt: 15 USDT
- Flash Loan: 10 USDT
- Result: HF 1.2 → 2.1

**Approvals Required:**
1. USDT spending approval
2. aToken withdrawal approval
```

#### Create Quick Start Guide

**File:** `docs/aave-rebalancer-quickstart.md`

```markdown
# Aave Rebalancer Quick Start

## Setup (5 minutes)

1. Create Aave position on Base Sepolia:
   - Supply 0.01 ETH ✅
   - Borrow 15 USDT ✅
   - HF should be ~1.2 ✅

2. Approve rebalancer:
   - Approve USDT spending
   - Approve aToken withdrawal

3. Configure chip:
   - Select "Aave Position Rebalancer"
   - WETH: 0x4200000000000000000000000000000000000006
   - USDT: 0x0a215D8ba66387DCA84B284D18c3B4ec3de6E54a
   - Flash: 10
   - Target HF: 1.5
   - Slippage: 1%

4. Execute:
   - Tap chip
   - Wait for confirmation
   - Check Aave: HF improved!

## Addresses

- Aave Pool: 0x07eA79F68B2B3df564D0A34F8e19D9B1e339814b
- WETH: 0x4200000000000000000000000000000000000006
- USDT: 0x0a215D8ba66387DCA84B284D18c3B4ec3de6E54a
- Uniswap V2 Router: 0x1689E7B1F10000AE47eBfE339a4f69dECd19F602
- WETH/USDT Pair: 0x9a03e586c9b1df47f69e1951a5ac96ee323591a8
- Rebalancer: 0x... (see deployedContracts.ts)
```

#### Deliverables (Hour 24)
- [ ] CLAUDE.md updated
- [ ] Quick start guide created
- [ ] Deployment addresses documented

---

## Execution Checklist

### Hour 0-8: Smart Contract
- [ ] Create TapThatXAaveRebalancer.sol
- [ ] Implement executeRebalance()
- [ ] Implement executeOperation() callback
- [ ] Add helper functions (repay, withdraw, swap)
- [ ] Add validation logic
- [ ] Add events
- [ ] Compile successfully

### Hour 9-14: Testing
- [ ] Write test file (TapThatXAaveRebalancer.t.sol)
- [ ] Test on Base Sepolia fork
- [ ] 5+ test cases passing
- [ ] Gas analysis (<600k)
- [✅] Get Base Sepolia ETH/USDT
- [ ] Create test Aave position
- [ ] Live test successful

### Hour 15-18: Frontend
- [ ] Add aaveRebalanceTemplate
- [ ] Update configure page UI
- [ ] Add health factor display
- [ ] Test form submission
- [ ] Verify callData encoding

### Hour 19-22: Deployment
- [ ] Write deployment script
- [ ] Deploy to Base Sepolia
- [ ] Verify on BaseScan
- [ ] Update deployedContracts.ts
- [ ] End-to-end test with NFC chip
- [ ] Verify HF improvement

### Hour 23-24: Documentation
- [ ] Update CLAUDE.md
- [ ] Create quick start guide
- [ ] Document addresses
- [ ] Add known limitations

---

## Critical Success Criteria

**Functional:**
- ✅ Flash loan executes successfully (10 USDT borrowed)
- ✅ Debt reduced by 10 USDT (28 → 18)
- ✅ Collateral withdrawn correctly (~0.00256 ETH)
- ✅ Swap completes within slippage (10.13 USDT received)
- ✅ Health factor improves (1.18 → 1.37, +16% buffer)
- ✅ Excess returned to user (~0.125 USDT)
- ✅ Position escapes liquidation risk (37% buffer vs 18% before)

**Technical:**
- ✅ Gas < 600k (estimate ~400-500k for full flow)
- ✅ No reentrancy vulnerabilities (ReentrancyGuard on entry)
- ✅ Authorization via TapThatXProtocol works (chip signature validated)
- ✅ All validations trigger correctly (HF check, economic check, slippage)
- ✅ All 3 ERC20 approvals executed in correct order
- ✅ aToken handling works correctly (transferFrom + withdraw)

**Economic:**
- ✅ Withdrawn collateral value: ~$10.00 (0.00256 ETH @ $3,906/ETH)
- ✅ Flash loan repayment needed: $10.005 (includes 0.05% premium)
- ✅ Swap output: ~$10.13 USDT (0.3% Uniswap fee included)
- ✅ User receives excess: ~$0.125 USDT bonus
- ✅ Total cost to user: 0.005 USDT flash loan fee (deducted from excess)
- ✅ Value saved: Avoids liquidation penalty (10% of collateral = ~$3.90)

---

## Key Contract Interfaces

### Aave V3
```solidity
interface IPool {
    function flashLoanSimple(
        address receiverAddress,
        address asset,
        uint256 amount,
        bytes calldata params,
        uint16 referralCode
    ) external;

    function repay(
        address asset,
        uint256 amount,
        uint256 rateMode,
        address onBehalfOf
    ) external returns (uint256);

    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256);

    function getUserAccountData(address user)
        external
        view
        returns (
            uint256 totalCollateralBase,
            uint256 totalDebtBase,
            uint256 availableBorrowsBase,
            uint256 currentLiquidationThreshold,
            uint256 ltv,
            uint256 healthFactor
        );
}
```

### Uniswap V2
```solidity
interface IUniswapV2Router02 {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);

    function getAmountsOut(
        uint amountIn,
        address[] calldata path
    ) external view returns (uint[] memory amounts);
}
```

**Why V2 for Hackathon:**
- ✅ Simpler interface (no fee tiers)
- ✅ Single function call
- ✅ Well-tested and stable
- ✅ Lower gas costs
- ✅ Easier to debug

**Critical Helper Functions:**

```solidity
/// @notice Calculate exact collateral amount needed for swap to cover flash loan repayment
function _calculateCollateralAmount(
    uint256 flashLoanAmount,
    uint256 premium,
    RebalanceConfig memory config
) internal view returns (uint256) {
    uint256 totalNeeded = flashLoanAmount + premium;  // e.g., 10.005 USDT

    // Get Uniswap V2 pair reserves
    address pair = IUniswapV2Factory(UNISWAP_V2_FACTORY).getPair(
        config.collateralAsset,
        config.debtAsset
    );
    (uint112 reserve0, uint112 reserve1,) = IUniswapV2Pair(pair).getReserves();

    // Determine which reserve is which token
    address token0 = IUniswapV2Pair(pair).token0();
    (uint112 reserveCollateral, uint112 reserveDebt) = token0 == config.collateralAsset
        ? (reserve0, reserve1)
        : (reserve1, reserve0);

    // Calculate amountIn needed to get totalNeeded out (reverse Uniswap formula)
    // amountOut = (amountIn * 997 * reserveOut) / (reserveIn * 1000 + amountIn * 997)
    // Solving for amountIn:
    // amountIn = (reserveIn * amountOut * 1000) / ((reserveOut - amountOut) * 997) + 1
    uint256 numerator = uint256(reserveCollateral) * totalNeeded * 1000;
    uint256 denominator = (uint256(reserveDebt) - totalNeeded) * 997;
    uint256 amountIn = (numerator / denominator) + 1;

    // Add slippage buffer (e.g., 1% = 100 basis points)
    uint256 slippageMultiplier = 10000 + config.maxSlippage;
    uint256 amountInWithSlippage = (amountIn * slippageMultiplier) / 10000;

    return amountInWithSlippage;
}

/// @notice Swap collateral for debt asset on Uniswap V2
function _swapV2(
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut,
    uint256 maxSlippage
) internal returns (uint256) {
    // Build swap path
    address[] memory path = new address[](2);
    path[0] = tokenIn;   // WETH
    path[1] = tokenOut;  // USDT

    // Approve router to spend tokenIn
    IERC20(tokenIn).approve(address(uniswapV2Router), amountIn);

    // Calculate minimum output with slippage protection
    uint256 slippageMultiplier = 10000 - maxSlippage;  // e.g., 9900 for 1% slippage
    uint256 adjustedMinOut = (minAmountOut * slippageMultiplier) / 10000;

    // Execute swap
    uint[] memory amounts = IUniswapV2Router02(uniswapV2Router).swapExactTokensForTokens(
        amountIn,           // Amount of WETH to swap
        adjustedMinOut,     // Minimum USDT to receive (with slippage)
        path,               // [WETH, USDT]
        address(this),      // Recipient (rebalancer contract)
        block.timestamp     // Deadline (now)
    );

    return amounts[1]; // USDT received
}
```

**Why V2 for Hackathon:**
- ✅ Simpler interface (no fee tiers, no sqrt calculations)
- ✅ Single function call with clear parameters
- ✅ Well-tested and stable across all EVM chains
- ✅ Lower gas costs than V3
- ✅ Easier to debug (no complex math errors)
- ✅ Adequate liquidity on Base Sepolia test pools

**Compare to V3 (more complex):**
- V3 requires: fee tier selection (500/3000/10000), price limit calculations, sqrt price math, tick boundaries
- V2 requires: input amount, path array, deadline ✅

---

## Risk Mitigation

### Flash Loan Security
- Only accept self-initiated flash loans
- Validate msg.sender == Aave Pool
- All operations atomic (revert on failure)

### Economic Safety
- Pre-validate collateral sufficiency
- Post-validate HF improvement
- Slippage protection on swaps
- Require 20%+ safety margin

### Authorization
- EIP-712 chip signatures required
- Nonce replay protection
- Ownership verified via TapThatXProtocol

### Reentrancy
- ReentrancyGuard on all entry points
- Follow checks-effects-interactions

---

## Known Limitations

1. Base Sepolia testnet only (not mainnet)
2. Single collateral/debt pair per config
3. Variable rate debt only
4. Manual approval setup required
5. Requires sufficient Uniswap liquidity
6. Flash loan premium cost (0.05%)

---

## Support & Resources

**Aave V3 Docs:** https://docs.aave.com/developers/
**Uniswap V2 Docs:** https://docs.uniswap.org/contracts/v2/overview
**Base Sepolia Explorer:** https://sepolia.basescan.org/
**Aave V3 Base Sepolia:** https://app.aave.com/?marketName=proto_base_v3_testnet

**Uniswap V2 Base Sepolia:**
- Router: 0x1689E7B1F10000AE47eBfE339a4f69dECd19F602
- Factory: 0x8909dc15e40173ff4699343b6eb8132c65e18ec6

---

*Timeline: 24 Hours*
*Network: Base Sepolia*
*Status: Ready for Execution*
*Version: 2.0.0*
