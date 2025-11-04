# TapThat X

<div align="center">

**Making Blockchain Physical**

_Tap your NFC chip to execute any blockchain transaction—no wallet popups, no gas fees, no friction_

[![Solidity](https://img.shields.io/badge/Solidity-^0.8.19-363636?logo=solidity)](https://soliditylang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![Base](https://img.shields.io/badge/Base-Sepolia-0052FF?logo=ethereum)](https://base.org/)
[![Optimism](https://img.shields.io/badge/Optimism-Sepolia-FF0420?logo=optimism)](https://optimism.io/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**[Live Demo](#) • [Documentation](#) • [Contracts](#smart-contracts)**

</div>

---

## 📊 Quick Stats

- **8 Smart Contracts** deployed across 2 testnets
- **5 Core Contracts** for universal execution
- **3 Advanced Extensions** (Bridge, Aave Flash Loans)
- **Sub-3-second** tap-to-pay experience
- **$0 gas fees** for users (relay-sponsored)
- **100% gasless** UX for end users

---

## 🎯 The Problem

Current blockchain UX creates insurmountable friction:

```
Traditional Web3 Transaction:
┌────────────────────────────────────────────┐
│ 1. Open wallet app                    (5s) │
│ 2. Switch to correct network         (10s) │
│ 3. Approve token spending            (15s) │
│ 4. Confirm transaction               (10s) │
│ 5. Wait for confirmation             (30s) │
│ 6. Check if it worked                 (5s) │
│                                             │
│ Total: 75 seconds, 6 steps, 4 popups       │
└────────────────────────────────────────────┘
```

**Result**: Users abandon transactions, developers compromise security for UX, mainstream adoption stalls.

---

## 💡 The Solution

**Physical tap authorization** replaces the entire flow:

```
TapThat X Transaction:
┌────────────────────────────────────────────┐
│ 1. Tap phone on NFC chip             (2s) │
│ 2. Transaction executes               (1s) │
│                                             │
│ Total: 3 seconds, 1 step, 0 popups         │
└────────────────────────────────────────────┘
```

### How It Works

1. **One-time setup**: Register NFC chip + pre-approve spending limits (5 minutes)
2. **Every transaction**: Tap phone → chip signs authorization → relay executes (3 seconds)
3. **Result**: Physical blockchain interactions with zero ongoing friction

---

## 🏗 System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         TapThat X Protocol                              │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────┐
│   NFC Chip (HaLo)   │  ← Secure element with private key
│  Signs EIP-712 msgs │     Keys never leave chip
└──────────┬──────────┘
           │ tap (Web NFC API)
           │ 2-3 seconds
┌──────────▼──────────┐
│  Mobile Device      │  ← @arx-research/libhalo
│  (Android/iOS)      │     Browser-based NFC reading
└──────────┬──────────┘
           │ HTTPS POST
           │ /api/relay-execute-tap
┌──────────▼──────────────────────────────────────┐
│  Gasless Relay (Next.js API)                    │  ← Backend relayer
│  - Validates request structure                  │     Pays gas for users
│  - Detects operation type                       │     Signs with private key
│  - Sets dynamic gas limits                      │
│  - Submits transaction on-chain                 │
└──────────┬──────────────────────────────────────┘
           │ writeContract()
           │ TapThatXExecutor.executeTap()
┌──────────▼──────────────────────────────────────┐
│  TapThatXExecutor (Orchestrator)                │
│  1. Fetch configuration from storage            │
│  2. Validate config active                      │
│  3. Delegate to Protocol for execution          │
└──────────┬──────────────────────────────────────┘
           │
    ┌──────┴──────────────────────────────┐
    │                                     │
┌───▼────────────────────┐   ┌───────────▼──────────────────────┐
│ TapThatXConfiguration  │   │   TapThatXProtocol               │
│ (Action Storage)       │   │   (Validation & Execution Engine)│
│                        │   │                                  │
│ getConfiguration()     │   │   executeAuthorizedCall()        │
│ → ActionConfig {       │   │   ├─ Verify nonce not used       │
│     target,            │   │   ├─ Recover chip from signature │
│     callData,          │   │   ├─ Validate timestamp <5 min   │
│     description        │   │   ├─ Check chip ownership        │
│   }                    │   │   ├─ Mark nonce used             │
│                        │   │   └─ Execute target.call()       │
└────────────────────────┘   └───────────┬──────────────────────┘
                                         │
                              ┌──────────┴─────────┐
                              │                    │
                     ┌────────▼──────────┐  ┌─────▼──────────────┐
                     │ TapThatXRegistry  │  │  Target Contract   │
                     │ (Chip Ownership)  │  │  (Action Execute)  │
                     │                   │  │                    │
                     │ hasChip()         │  │  • ERC20 transfer  │
                     │ → validates owner │  │  • Bridge ETH      │
                     │   owns chip       │  │  • Aave rebalance  │
                     └───────────────────┘  │  • Uniswap swap    │
                                            │  • Custom call     │
                                            └────────────────────┘
```

---

## 🎨 Alternative: Compact Slide Version

For tighter space constraints:

```
                        TapThat X Protocol Flow

┌─────────┐   tap    ┌──────────┐   POST   ┌────────────┐   tx    ┌─────────┐
│ NFC Chip│ ───────> │  Mobile  │ ──────>  │   Relay    │ ──────> │ On-Chain│
│  (HaLo) │  2-3sec  │  Browser │   API    │  (Gasless) │  write  │ Executor│
└─────────┘          └──────────┘          └────────────┘         └────┬────┘
                                                                        │
      Signs EIP-712      Web NFC API      Validates & Pays Gas         │
      Private key        @arx-research/    Dynamic gas limits           │
      never leaves       libhalo                                        │
                                                                        ▼
                     ┌──────────────────────────────────────────────────────┐
                     │          Smart Contract Layer (Hedera)              │
                     │                                                      │
                     │  [Executor] → [Protocol] → [Registry] + [Target]    │
                     │     ↓            ↓            ↓            ↓         │
                     │  Orchestrate  Validate   Check owner  Execute call  │
                     │  config       signature  & nonce     (ERC20, swap,  │
                     │                                       bridge, etc)   │
                     └──────────────────────────────────────────────────────┘

## 📜 Smart Contracts

### Contract Dependency Graph

```

┌─────────────────────────────────────────────────────────────────┐
│ Contract Architecture │
└─────────────────────────────────────────────────────────────────┘

                    ┌──────────────────────┐
                    │ TapThatXRegistry     │  ← No dependencies
                    │ (Chip ↔ Owner map)   │     Foundation layer
                    └──────────┬───────────┘
                               │ depends on
                ┌──────────────┴──────────────┐
                │                             │
      ┌─────────▼──────────┐      ┌──────────▼──────────────┐
      │ TapThatXProtocol   │      │ TapThatXConfiguration   │
      │ (Core execution)   │      │ (Action storage)        │
      └─────────┬──────────┘      └──────────┬──────────────┘
                │                             │
                └──────────┬──────────────────┘
                           │ both required
                ┌──────────▼──────────────┐
                │  TapThatXExecutor       │
                │  (Simplified interface) │
                └──────────┬──────────────┘
                           │ required by extensions
            ┌──────────────┼──────────────┐
            │              │              │

┌───────────▼──────┐ ┌─────▼──────┐ ┌────▼─────────────────┐
│ TapThatXBridge │ │ TapThatX │ │ TapThatXAave │
│ ETHViaWETH │ │ Aave │ │ PositionCloser │
│ (Dual L2 bridge) │ │ Rebalancer │ │ (Flash loan close) │
└──────────────────┘ └────────────┘ └──────────────────────┘
Extension Extension Extension
(Sepolia only) (Base only) (Base only)

````

---

### Core Contracts

#### 1. TapThatXRegistry

**Purpose**: Chip ownership registry with EIP-712 proof of possession

**Deployed At**:

- Base Sepolia: `0x91D05d5B8913BCdA59f1923dC6831B108154Df22`
- Sepolia: `0x...` (see [deployedContracts.ts](packages/nextjs/contracts/deployedContracts.ts))

**Key Data Structures**:

```solidity
// Bidirectional mappings for O(1) lookups
mapping(address => address[]) private ownerToChips;
mapping(address => address[]) private chipToOwners;
mapping(address => mapping(address => bool)) public ownerHasChip;
````

**Key Functions**:

```solidity
function registerChip(address chipAddress, bytes memory chipSignature) external
```

- **Purpose**: Register NFC chip to owner with cryptographic proof
- **Validation**: Verifies chip signed EIP-712 `ChipRegistration` message
- **Security**: Uses chain-agnostic domain separator (no `chainId`)
- **Gas**: ~150k

```solidity
function getOwnerChips(address owner) external view returns (address[] memory)
```

- **Purpose**: Get all chips registered to an owner
- **Use case**: Display user's registered chips in UI

```solidity
function hasChip(address owner, address chip) external view returns (bool)
```

- **Purpose**: Fast ownership validation
- **Use case**: Called by Protocol before every execution

**EIP-712 Domain** (Chain-Agnostic):

```solidity
{
  name: "TapThatXRegistry",
  version: "1",
  verifyingContract: address(this)
  // Deliberately excludes chainId for cross-chain chip reuse
}
```

**Innovation**: Chips registered once work across all EVM chains where protocol is deployed.

---

#### 2. TapThatXProtocol

**Purpose**: Core execution engine for chip-authorized contract calls

**Deployed At**:

- Base Sepolia: `0x0F917750db157D65c6c14e5Ce5828a250569afE1`

**Security Features**:

- ✅ Nonce-based replay protection (`mapping(bytes32 => bool) usedNonces`)
- ✅ Timestamp validation (5-minute expiration window)
- ✅ Chip ownership verification (via Registry)
- ✅ ReentrancyGuard protection
- ✅ EIP-712 signature validation

**Key Function**:

```solidity
function executeAuthorizedCall(
    address owner,              // Chip owner (transaction originator)
    address target,             // Contract to call (e.g., USDC, Aave)
    bytes calldata callData,    // Encoded function call
    uint256 value,              // ETH value (0 for most ops)
    bytes memory chipSignature, // Chip's EIP-712 signature
    uint256 timestamp,          // Authorization timestamp
    bytes32 nonce              // Unique nonce (prevents replay)
) external payable nonReentrant returns (bool success, bytes memory returnData)
```

**Execution Flow**:

```
1. Validate nonce unused          require(!usedNonces[nonce])
2. Recover chip from signature    TapThatXAuth.recoverChipFromCallAuth()
3. Validate timestamp fresh       require(block.timestamp - timestamp <= 300)
4. Verify chip ownership          require(registry.hasChip(owner, chip))
5. Mark nonce used               usedNonces[nonce] = true
6. Execute call                  target.call{value}(callData)
7. Emit event                    AuthorizedCallExecuted(...)
```

**CallAuthorization Struct** (EIP-712):

```solidity
struct CallAuthorization {
    address owner;      // Chip owner
    address target;     // Contract to call
    bytes callData;     // Function call data
    uint256 value;      // ETH value
    uint256 timestamp;  // Authorization time
    bytes32 nonce;      // Unique nonce
}
```

**Gas Cost**: 130-150k (simple transfers) to 3M (complex DeFi)

---

#### 3. TapThatXConfiguration

**Purpose**: On-chain storage for pre-configured chip actions

**Deployed At**:

- Base Sepolia: `0x...` (see deployedContracts.ts)

**Data Structure**:

```solidity
struct ActionConfig {
    address targetContract;      // e.g., 0xUSDC
    bytes staticCallData;        // Pre-encoded function call
    uint256 value;              // ETH to send (0 for ERC20)
    string description;         // "Send 100 USDC to Alice"
    bool isActive;             // Enable/disable toggle
}

mapping(address => mapping(address => ActionConfig)) public configurations;
// Structure: owner → chip → ActionConfig
```

**Key Functions**:

```solidity
function setConfiguration(
    address chip,
    address targetContract,
    bytes calldata staticCallData,
    uint256 value,
    string calldata description
) external
```

- **Access Control**: Only chip owner can configure
- **Validation**: `require(registry.hasChip(msg.sender, chip))`
- **Storage**: Saves to `configurations[msg.sender][chip]`

```solidity
function getConfiguration(address owner, address chip)
    external view returns (ActionConfig memory)
```

- **Purpose**: Fetch pre-configured action
- **Used by**: TapThatXExecutor before every execution

```solidity
function toggleConfiguration(address chip) external
```

- **Purpose**: Enable/disable without deleting configuration
- **Use case**: Pause payments while keeping configuration

---

#### 4. TapThatXExecutor

**Purpose**: Simplified interface that combines configuration fetch + execution

**Deployed At**:

- Base Sepolia: `0x...`

**Key Function**:

```solidity
function executeTap(
    address owner,
    address chip,
    bytes memory chipSignature,
    uint256 timestamp,
    bytes32 nonce
) external payable nonReentrant returns (bool, bytes memory)
```

**Execution Steps**:

```solidity
// 1. Fetch configuration
ActionConfig memory config = configuration.getConfiguration(owner, chip);

// 2. Validate configuration
require(config.targetContract != address(0), "No configuration");
require(config.isActive, "Configuration inactive");

// 3. Execute via protocol
(bool success, bytes memory data) = protocol.executeAuthorizedCall{value: config.value}(
    owner,
    config.targetContract,
    config.staticCallData,
    config.value,
    chipSignature,
    timestamp,
    nonce
);

// 4. Emit event
emit TapExecuted(owner, chip, config.targetContract, nonce, success, config.description);
```

**Why Use Executor?**

- **Simpler**: Single function call instead of fetching config separately
- **Safer**: Validates config exists and is active
- **Gas-efficient**: Optimized for relay usage

---

#### 5. TapThatXAuth (Library)

**Purpose**: Signature verification utilities for EIP-712

**Key Functions**:

```solidity
function recoverChipFromCallAuth(
    bytes32 domainSeparator,
    CallAuthorization memory auth,
    bytes memory signature
) internal pure returns (address chipAddress)
```

**Implementation**:

```solidity
// 1. Build struct hash
bytes32 structHash = keccak256(abi.encode(
    CALL_AUTH_TYPEHASH,
    auth.owner,
    auth.target,
    keccak256(auth.callData),  // Hash callData
    auth.value,
    auth.timestamp,
    auth.nonce
));

// 2. Build EIP-712 digest
bytes32 digest = keccak256(abi.encodePacked(
    "\x19\x01",
    domainSeparator,
    structHash
));

// 3. Recover signer
return digest.recover(signature);
```

```solidity
function validateTimestamp(uint256 timestamp, uint256 maxWindow)
    internal view returns (bool)
```

- **Validation**: `timestamp <= block.timestamp && (block.timestamp - timestamp) <= maxWindow`
- **Window**: 300 seconds (5 minutes)

---

### Extension Contracts

#### 6. TapThatXBridgeETHViaWETH

**Purpose**: Gasless cross-chain ETH bridging to Base + Optimism Sepolia

**Deployed At**:

- Sepolia: `0x...` (L1 only)

**Why This Extension?**

Problem: Users need ETH on L2s but lack gas to bridge.
Solution: Use WETH (ERC20) approval → unwrap → bridge atomically.

**Key Function**:

```solidity
function unwrapAndBridgeDual(
    address owner,
    uint32 minGasLimitOP,
    uint32 minGasLimitBase
) external
```

**Execution Flow**:

```
1. Pull pre-approved WETH        weth.transferFrom(owner, this, amount)
2. Unwrap WETH → ETH            weth.withdraw(amount)
3. Split amount for 2 chains    toBase = amount / 2; toOP = amount - toBase
4. Bridge to Base Sepolia       bridgeBase.depositETHTo{value: toBase}(...)
5. Bridge to OP Sepolia         bridgeOP.depositETHTo{value: toOP}(...)
6. Emit event                   ETHBridgedViaWETH(...)
```

**Gas Requirements**: 3M gas

- OP bridge: ~913k
- Base bridge: ~650k
- Cross-chain messaging: ~200k
- WETH operations: ~150k
- Safety buffer: ~1.1M

**Network Addresses** (Sepolia):

```solidity
WETH = 0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9
BRIDGE_OP = 0xFBb0621E0B23b5478B630BD55a5f21f67730B0F1  // L1StandardBridge
BRIDGE_BASE = 0xfd0Bf71F60660E2f608ed56e1659C450eB113120 // L1StandardBridge
```

**User Flow**:

```
Setup (once):
  1. Approve WETH to bridge extension

Execute (anytime):
  1. Tap chip
  2. Extension pulls WETH, unwraps, bridges
  3. User receives ETH on both L2s
```

---

#### 7. TapThatXAaveRebalancer

**Purpose**: Atomically rebalance Aave positions using flash loans

**Deployed At**:

- Base Sepolia: `0x...`

**The Impossible Problem**:

To rebalance an Aave position (reduce debt, improve health factor), users need:

- **Option 1**: Deposit more collateral (requires capital)
- **Option 2**: Repay debt (requires debt tokens)
- **Option 3**: Flash loan + complex execution (requires technical knowledge)

**TapThat X Solution**: One tap executes flash loan rebalancing.

**Optimal Flash Loan Formula**:

```
Health Factor: HF = (totalCollateral × liquidationThreshold) / totalDebt

Target: targetHF = (totalCollateral × LT) / (totalDebt - debtRepaid)

Solving for debtRepaid:

debtRepaid = (targetHF × totalDebt - totalCollateral × LT) / (targetHF - costFactor × LT)

Where:
  costFactor = 1.0000 + 0.0009 (flash fee) + 0.0030 (margin) + maxSlippage
```

**Implementation**:

```solidity
function calculateOptimalFlashLoan(address owner, RebalanceConfig memory config)
    public view returns (uint256 flashLoanAmount)
{
    // Get Aave position data (USD, 8 decimals)
    (uint256 collateralUSD, uint256 debtUSD, , uint256 ltBps, , uint256 hf) =
        POOL.getUserAccountData(owner);

    if (hf >= config.targetHealthFactor) return 0;

    // Normalize to 18 decimals for precision
    uint256 collateral18 = collateralUSD * 1e10;
    uint256 debt18 = debtUSD * 1e10;
    uint256 lt18 = (ltBps * 1e18) / 10000;

    // Cost factor (basis points → 18 decimals)
    // 10000 + 9 (flash) + 30 (margin) + slippage
    uint256 costFactorBps = 10000 + 9 + 30 + config.maxSlippage;
    uint256 costFactor18 = (costFactorBps * 1e18) / 10000;

    // Formula application
    uint256 numerator = (config.targetHealthFactor * debt18 / 1e18) -
                        (collateral18 * lt18 / 1e18);
    uint256 denominator = config.targetHealthFactor - (costFactor18 * lt18 / 1e18);

    uint256 debtRepaidUSD = (numerator * 1e18 / denominator) / 1e10; // Back to 8 decimals

    // Convert USD → token amount via Aave oracle
    address oracle = IPoolAddressesProvider(POOL.ADDRESSES_PROVIDER()).getPriceOracle();
    uint256 price = IAaveOracle(oracle).getAssetPrice(config.debtAsset);
    uint256 decimals = IERC20Metadata(config.debtAsset).decimals();

    return (debtRepaidUSD * (10 ** decimals)) / price;
}
```

**Flash Loan Callback Execution** (All Atomic):

```solidity
function executeOperation(...) external returns (bool) {
    // Step 1: Repay debt with flash loan
    IERC20(debtAsset).approve(address(POOL), flashAmount);
    POOL.repay(debtAsset, flashAmount, 2, owner);  // Variable rate

    // Step 2: Withdraw collateral (aToken)
    address aToken = POOL.getReserveData(collateralAsset).aTokenAddress;
    IERC20(aToken).transferFrom(owner, address(this), collateralAmount);
    POOL.withdraw(collateralAsset, collateralAmount, address(this));

    // Step 3: Swap collateral → debt asset (Uniswap V2)
    uint256 totalRepayment = flashAmount + premium;
    uint256 swapOutput = _swapV2(collateralAsset, debtAsset, collateralAmount, totalRepayment);

    // Step 4: Approve Aave to pull repayment
    IERC20(debtAsset).approve(address(POOL), totalRepayment);

    // Step 5: Return excess to user
    uint256 excess = swapOutput - totalRepayment;
    if (excess > 0) IERC20(debtAsset).transfer(owner, excess);

    // Step 6: Verify health factor improved
    (, , , , , uint256 hfAfter) = POOL.getUserAccountData(owner);
    require(hfAfter > hfBefore, "Health factor not improved");

    return true;  // Aave auto-pulls totalRepayment
}
```

**Uniswap V2 Calculation**:

```solidity
// Constant product formula: x × y = k
// Given output (totalRepayment), calculate input needed:
// amountIn = (reserveIn × amountOut × 1000) / ((reserveOut - amountOut) × 997)

uint256 numerator = uint256(reserveCollateral) * totalRepayment * 1000;
uint256 denominator = (uint256(reserveDebt) - totalRepayment) * 997;  // 0.3% fee
uint256 amountIn = (numerator / denominator) + 1;

// Add slippage buffer
uint256 slippageMultiplier = 10000 + config.maxSlippage;
return (amountIn * slippageMultiplier) / 10000;
```

**Gas Requirements**: 1.5M

- Flash loan callback: 200k
- Aave operations: 350k
- Uniswap swap: 300k
- Verifications: 200k
- Buffer: 450k

**Example**: Health factor 1.05 → 2.5 in one tap

---

#### 8. TapThatXAavePositionCloser

**Purpose**: Fully close Aave positions (repay all debt, withdraw all collateral)

**Key Difference from Rebalancer**:

- **Rebalancer**: Reduces debt to improve health factor
- **Closer**: Repays ALL debt and withdraws ALL collateral

**Execution Flow**:

```
1. Calculate total debt       flashLoanAmount = total variable debt
2. Flash loan exact amount    POOL.flashLoanSimple(debtAsset, amount, ...)
3. Repay ALL debt            POOL.repay(debtAsset, amount, 2, owner)
4. Withdraw ALL collateral   POOL.withdraw(collateralAsset, aTokenBalance, ...)
5. Swap collateral → debt    swapOutput = _swapV2(collateral, debt, ...)
6. Repay flash loan          IERC20(debt).approve(POOL, repayment)
7. Return excess to user     transfer(owner, remainingCollateral + excessDebt)
8. Verify fully closed       require(remainingDebt == 0)
```

---

## 🔄 User Flows

### Registration Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      Chip Registration                           │
└─────────────────────────────────────────────────────────────────┘

User                  Frontend               NFC Chip              Blockchain
  │                      │                       │                      │
  │  Navigate to         │                       │                      │
  │  /register          │                       │                      │
  ├────────────────────>│                       │                      │
  │                      │                       │                      │
  │  Click "Register"   │                       │                      │
  ├────────────────────>│                       │                      │
  │                      │                       │                      │
  │                      │  Step 1: Detect Chip │                      │
  │                      │  "Hold device near   │                      │
  │                      │   NFC chip..."       │                      │
  │                      │                       │                      │
  │  Tap phone on chip  │                       │                      │
  ├────────────────────>│─ signMessage("init") ─>                      │
  │                      │                       │                      │
  │                      │<─ {address, sig} ─────┤                      │
  │                      │                       │                      │
  │                      │  chipAddress detected │                      │
  │                      │  0x742d...             │                      │
  │                      │                       │                      │
  │                      │  Step 2: Sign Auth    │                      │
  │                      │  "Tap again to        │                      │
  │                      │   authorize..."       │                      │
  │                      │                       │                      │
  │  Tap chip again     │                       │                      │
  ├────────────────────>│─ signTypedData({      │                      │
  │                      │    domain: {          │                      │
  │                      │      name: "TapThatX  │                      │
  │                      │             Registry",│                      │
  │                      │      version: "1"     │                      │
  │                      │    },                 │                      │
  │                      │    message: {         │                      │
  │                      │      owner: 0xUser,   │                      │
  │                      │      chip: 0x742d     │                      │
  │                      │    }                  │                      │
  │                      │  }) ──────────────────>                      │
  │                      │                       │                      │
  │                      │                       │  Chip signs EIP-712  │
  │                      │                       │  with private key    │
  │                      │                       │                      │
  │                      │<─ chipSignature ──────┤                      │
  │                      │                       │                      │
  │                      │  Step 3: Submit Tx    │                      │
  │                      │  "Confirm in wallet"  │                      │
  │                      │                       │                      │
  │  Approve in wallet  │                       │                      │
  ├────────────────────>│─ writeContract({      │                      │
  │                      │    fn: "registerChip",│                      │
  │                      │    args: [            │                      │
  │                      │      0x742d,          │                      │
  │                      │      signature        │                      │
  │                      │    ]                  │                      │
  │                      │  }) ──────────────────────────────────────>│
  │                      │                       │                      │
  │                      │                       │   TapThatXRegistry   │
  │                      │                       │   1. Recover signer  │
  │                      │                       │   2. Verify == chip  │
  │                      │                       │   3. Store mapping   │
  │                      │                       │      owner→chips[]   │
  │                      │                       │      chip→owners[]   │
  │                      │                       │                      │
  │                      │<────── tx hash ───────────────────────────────┤
  │                      │                       │                      │
  │  ✅ Success!         │                       │                      │
  │  "Chip registered"  │                       │                      │
  │<────────────────────┤                       │                      │
  │                      │                       │                      │

Total Time: ~30 seconds
User Actions: 3 taps, 1 wallet approval
Result: Chip → Owner mapping stored on-chain
```

---

### Execution Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Tap-to-Execute Flow                               │
└─────────────────────────────────────────────────────────────────────┘

User          Frontend       NFC Chip      Relay API        Blockchain
 │               │               │              │                 │
 │ Tap phone     │               │              │                 │
 │ on chip      │               │              │                 │
 ├─────────────>│               │              │                 │
 │               │ Step 1:       │              │                 │
 │               │ Detect chip   │              │                 │
 │               ├─ signMessage ─>              │                 │
 │               │   ("init")    │              │                 │
 │               │<─ {address} ──┤              │                 │
 │               │               │              │                 │
 │               │ Verify chip   │              │                 │
 │               │ ownership     │              │                 │
 │               ├─ registry.hasChip() ─────────────────────────>│
 │               │<─ true ──────────────────────────────────────┤
 │               │               │              │                 │
 │               │ Fetch config  │              │                 │
 │               ├─ config.getConfiguration() ──────────────────>│
 │               │<─ ActionConfig {              │                 │
 │               │     target: USDC,             │                 │
 │               │     callData: transferFrom()  │                 │
 │               │   } ──────────────────────────────────────────┤
 │               │               │              │                 │
 │               │ Preview:      │              │                 │
 │               │ "Send 10 USDC │              │                 │
 │               │  to Alice"    │              │                 │
 │               │               │              │                 │
 │               │ Step 2:       │              │                 │
 │               │ Authorize     │              │                 │
 │ Tap again     │               │              │                 │
 ├─────────────>│─ signTypedData({             │                 │
 │               │    CallAuth: {│              │                 │
 │               │      owner,   │              │                 │
 │               │      target,  │              │                 │
 │               │      callData,│              │                 │
 │               │      timestamp,              │                 │
 │               │      nonce    │              │                 │
 │               │    }          │              │                 │
 │               │  }) ──────────>              │                 │
 │               │<─ signature ──┤              │                 │
 │               │               │              │                 │
 │               │ Step 3:       │              │                 │
 │               │ Send to relay │              │                 │
 │               ├─ POST /api/relay-execute-tap ─>               │
 │               │   {           │              │                 │
 │               │     owner,    │              │                 │
 │               │     chip,     │              │                 │
 │               │     signature,│              │                 │
 │               │     timestamp,│              │                 │
 │               │     nonce     │              │                 │
 │               │   }           │              │                 │
 │               │               │              │                 │
 │               │               │              │ Relay validates │
 │               │               │              │ input structure │
 │               │               │              │                 │
 │               │               │              │ Detect operation│
 │               │               │              │ (simple/Aave/   │
 │               │               │              │  bridge)        │
 │               │               │              │                 │
 │               │               │              │ Set gas limit:  │
 │               │               │              │ - Simple: auto  │
 │               │               │              │ - Aave: 1.5M    │
 │               │               │              │ - Bridge: 3M    │
 │               │               │              │                 │
 │               │               │              │ Submit tx       │
 │               │               │              ├─ executeTap() ──>
 │               │               │              │                 │
 │               │               │              │   Executor:     │
 │               │               │              │   1. Fetch config
 │               │               │              │   2. Validate   │
 │               │               │              │                 │
 │               │               │              │   Protocol:     │
 │               │               │              │   3. Nonce check│
 │               │               │              │   4. Recover chip
 │               │               │              │   5. Timestamp  │
 │               │               │              │   6. Ownership  │
 │               │               │              │   7. Execute    │
 │               │               │              │      target.call│
 │               │               │              │                 │
 │               │               │              │<─ success ──────┤
 │               │               │              │                 │
 │               │<────── {success, txHash} ────┤                 │
 │               │               │              │                 │
 │ ✅ Success!   │               │              │                 │
 │ "10 USDC sent │               │              │                 │
 │  to Alice"    │               │              │                 │
 │<──────────────┤               │              │                 │

Total Time: 3 seconds
User Actions: 2 taps
Gas Paid By: Relay
User Gas Cost: $0
```

---

### Aave Flash Loan Rebalancing Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│              Aave Position Rebalancing (Flash Loan)                   │
└──────────────────────────────────────────────────────────────────────┘

Scenario: User's health factor is 1.05 (5% from liquidation)
Goal: Improve to 2.5 (safe zone)

Tap → Relay → TapThatXExecutor → TapThatXAaveRebalancer
                                        │
                                        │ calculateOptimalFlashLoan()
                                        │ Returns: 1000 USDT needed
                                        │
                                        ▼
                          ┌─────────────────────────┐
                          │  Aave V3 Pool           │
                          │  flashLoanSimple()      │
                          └───────────┬─────────────┘
                                      │
                          Flash 1000 USDT (0.09% fee = 0.9 USDT)
                                      │
                                      ▼
                          ┌─────────────────────────────────────┐
                          │  executeOperation() Callback        │
                          │  (All steps atomic)                 │
                          └─────────────────────────────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        │                             │                             │
        ▼                             ▼                             ▼
┌──────────────┐            ┌──────────────────┐         ┌─────────────┐
│ Step 1:      │            │ Step 2:          │         │ Step 3:     │
│ Repay Debt   │            │ Withdraw         │         │ Swap        │
│              │            │ Collateral       │         │             │
│ POOL.repay(  │            │                  │         │ Uniswap V2  │
│   USDT,      │            │ 1. transferFrom  │         │             │
│   1000,      │            │    user's aToken │         │ collateral  │
│   owner      │            │ 2. POOL.withdraw │         │     ↓       │
│ )            │            │    collateral    │         │   USDT      │
│              │            │                  │         │             │
│ Health: 1.05 │            │ Health: improved │         │ Output:     │
│   → 2.5+     │            │ (debt reduced)   │         │ 1000.9 USDT │
└──────────────┘            └──────────────────┘         └─────────────┘
                                      │
                                      ▼
                          ┌─────────────────────────┐
                          │ Step 4:                 │
                          │ Repay Flash Loan        │
                          │                         │
                          │ Approve: 1000.9 USDT    │
                          │ Aave auto-pulls at      │
                          │ function end            │
                          └─────────┬───────────────┘
                                    │
                                    ▼
                          ┌─────────────────────────┐
                          │ Step 5:                 │
                          │ Return Excess           │
                          │                         │
                          │ Excess collateral → user│
                          │ Excess USDT → user      │
                          └─────────┬───────────────┘
                                    │
                                    ▼
                          ┌─────────────────────────┐
                          │ Step 6:                 │
                          │ Verify                  │
                          │                         │
                          │ require(hfAfter > 1.05) │
                          │ require(hfAfter >= 2.5) │
                          └─────────────────────────┘
                                    │
                                    ▼
                          ✅ Position Rebalanced
                          Health Factor: 1.05 → 2.5
                          User paid: $0 (gasless)
                          Time: ~60 seconds

Key Innovation: Repay debt FIRST (improves health) → THEN withdraw collateral (safe)
Traditional approach (withdraw → swap → repay) would trigger liquidation
```

---

## 🚀 Technical Innovations

### 1. Chain-Agnostic Domain Separator

**Standard EIP-712** (chain-locked):

```solidity
keccak256(abi.encode(
    keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
    keccak256(bytes("TapThatXRegistry")),
    keccak256(bytes("1")),
    block.chainid,         // ← Locks to specific chain
    address(this)
))
```

**TapThat X** (cross-chain compatible):

```solidity
keccak256(abi.encode(
    keccak256("EIP712Domain(string name,string version,address verifyingContract)"),
    keccak256(bytes("TapThatXRegistry")),
    keccak256(bytes("1")),
    address(this)
    // No chainId ← Chip works on any chain
))
```

**Benefit**: Register chip once on Sepolia → use on Base, OP, Mainnet, Arbitrum without re-registration.

**Security**: Maintained via per-chain nonce tracking in TapThatXProtocol.

---

---

### 3. BigInt Serialization for HaLo Chips

**Problem**: HaLo library uses JSON (no BigInt support), but Viem uses BigInt for uint256 precision.

**Solution**: Recursive BigInt → string conversion before NFC signing.

**Implementation** (`useHaloChip.ts`):

```typescript
const serializeBigInt = (obj: any): any => {
  if (typeof obj === "bigint") return obj.toString();
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, serializeBigInt(v)])
  );
};

// Usage in signTypedData
const typedDataPayload = {
  domain,
  types,
  primaryType,
  value: serializeBigInt(message), // Recursive conversion
};

const result = await execHaloCmdWeb({
  name: "sign",
  keyNo: 1,
  typedData: typedDataPayload,
});
```

**Example**:

```typescript
// Input
{ owner: "0x123", value: 1000000000000000000n, timestamp: 1698765432n }

// After serialization
{ owner: "0x123", value: "1000000000000000000", timestamp: "1698765432" }
```

---

### 4. Flash Loan Sequence Reversal

**Traditional Approach** (fails):

```
1. Withdraw collateral from Aave
2. Swap collateral for debt token
3. Repay debt
❌ Fails: Withdrawing before repaying triggers liquidation
```

**TapThat X Approach** (succeeds):

```
1. Flash loan debt token
2. Repay debt (health factor improves)
3. Withdraw collateral (now safe)
4. Swap collateral for debt token
5. Repay flash loan
✅ Succeeds: Debt repayment improves health before withdrawal
```

**Key Insight**: Improving health factor BEFORE withdrawing enables safe collateral removal.

---

### 5. Gasless via transferFrom Pattern

**Traditional Gasless** (requires relayer trust):

```
User sends tokens to relayer → Relayer submits transaction
❌ Risk: Relayer could steal tokens
```

**TapThat X Gasless** (trustless):

```solidity
// User approves once
IERC20(token).approve(extensionAddress, maxUint256);

// Extension pulls during execution (relayer can't access)
IERC20(token).transferFrom(owner, address(this), amount);

// Smart contract validates chip signature (relayer can't forge)
require(registry.hasChip(owner, chip), "Ownership validation");
```

**Security**: Relay pays gas but cannot steal funds. On-chain validation prevents forgery.

---

## 🎨 Frontend Architecture

### Pages

```
┌─────────────────────────────────────────────────────────────┐
│                   Frontend Structure                         │
└─────────────────────────────────────────────────────────────┘

app/
├── page.tsx                    → Landing page (/)
├── register/page.tsx           → Chip registration (/register)
├── approve/page.tsx            → Token approval (/approve)
├── configure/page.tsx          → Action configuration (/configure)
└── execute/page.tsx            → Tap-to-execute (/execute)

hooks/
├── useHaloChip.ts              → NFC hardware integration
└── useGaslessRelay.ts          → Backend relay API

utils/
└── actionTemplates.ts          → CallData builders
    ├── erc20TransferTemplate
    ├── aaveRebalanceTemplate
    └── bridgeETHTemplate

api/
└── relay-execute-tap/route.ts → Gasless relay endpoint
```

---

### Custom Hooks

#### useHaloChip

**Purpose**: Interface to HaLo NFC chip hardware via Web NFC API

**Functions**:

```typescript
const { signMessage, signTypedData, isLoading, error } = useHaloChip();

// Chip detection (returns address)
const { address, signature } = await signMessage({
  message: "init",
  format: "text"
});

// EIP-712 signing
const { address, signature } = await signTypedData({
  domain: { name: "TapThatXProtocol", version: "1", verifyingContract },
  types: { CallAuthorization: [...] },
  primaryType: "CallAuthorization",
  message: { owner, target, callData, value, timestamp, nonce }
});
```

**Library**: `@arx-research/libhalo@1.3.2`

**Platforms**:

- ✅ Android Chrome (native Web NFC)
- ⚠️ iOS Safari (requires NFC-enabled browser or app)

---

#### useGaslessRelay

**Purpose**: Submit transactions to gasless relay API

**Function**:

```typescript
const { relayExecuteTap } = useGaslessRelay();

const result = await relayExecuteTap({
  owner: "0x...",
  chip: "0x...",
  chipSignature: "0x...",
  timestamp: 1234567890,
  nonce: "0x...",
});

// Returns: { success: true, transactionHash: "0x...", blockNumber: "12345" }
```

**Endpoint**: `POST /api/relay-execute-tap`

---

### Action Templates

**Purpose**: Build callData for common DeFi operations

**ERC20 Transfer Template**:

```typescript
const erc20TransferTemplate = {
  id: "erc20-transfer",
  name: "ERC20 Transfer",
  buildCallData: (params: {
    tokenAddress: `0x${string}`;
    from: `0x${string}`;
    to: `0x${string}`;
    amount: bigint;
  }) => {
    const callData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "transferFrom",
      args: [params.from, params.to, params.amount],
    });
    return { target: params.tokenAddress, callData, value: 0n };
  },
};
```

**Aave Rebalance Template**:

```typescript
const aaveRebalanceTemplate = {
  id: "aave-rebalance",
  buildCallData: (params: {
    rebalancerAddress: `0x${string}`;
    owner: `0x${string}`;
    collateralAsset: `0x${string}`;
    debtAsset: `0x${string}`;
    targetHealthFactor: bigint;
    maxSlippage: bigint;
  }) => {
    const callData = encodeFunctionData({
      abi: AAVE_REBALANCER_ABI,
      functionName: "executeRebalance",
      args: [
        params.owner,
        {
          collateralAsset: params.collateralAsset,
          debtAsset: params.debtAsset,
          targetHealthFactor: params.targetHealthFactor,
          maxSlippage: params.maxSlippage,
        },
      ],
    });
    return { target: params.rebalancerAddress, callData, value: 0n };
  },
};
```

---

## 🌐 Network Deployments

### Supported Networks

| Network              | Chain ID | Purpose        | Contracts                                 |
| -------------------- | -------- | -------------- | ----------------------------------------- |
| **Ethereum Sepolia** | 11155111 | Bridge testing | Core (5) + Bridge (1)                     |
| **Base Sepolia**     | 84532    | Full features  | Core (5) + DeFi Extensions (3) + MockUSDC |

### Contract Addresses

#### Base Sepolia (84532)

| Contract                   | Address                                                                    |
| -------------------------- | -------------------------------------------------------------------------- |
| MockUSDC                   | `0xb090ae6dd89b25d1b79718853c439d1354bf62c5`                               |
| TapThatXRegistry           | `0x91D05d5B8913BCdA59f1923dC6831B108154Df22`                               |
| TapThatXProtocol           | `0x0F917750db157D65c6c14e5Ce5828a250569afE1`                               |
| TapThatXConfiguration      | See [deployedContracts.ts](packages/nextjs/contracts/deployedContracts.ts) |
| TapThatXExecutor           | See [deployedContracts.ts](packages/nextjs/contracts/deployedContracts.ts) |
| TapThatXAaveRebalancer     | See [deployedContracts.ts](packages/nextjs/contracts/deployedContracts.ts) |
| TapThatXAavePositionCloser | See [deployedContracts.ts](packages/nextjs/contracts/deployedContracts.ts) |

#### Sepolia (11155111)

| Contract                 | Address                                                                    |
| ------------------------ | -------------------------------------------------------------------------- |
| TapThatXRegistry         | See [deployedContracts.ts](packages/nextjs/contracts/deployedContracts.ts) |
| TapThatXProtocol         | See [deployedContracts.ts](packages/nextjs/contracts/deployedContracts.ts) |
| TapThatXConfiguration    | See [deployedContracts.ts](packages/nextjs/contracts/deployedContracts.ts) |
| TapThatXExecutor         | See [deployedContracts.ts](packages/nextjs/contracts/deployedContracts.ts) |
| TapThatXBridgeETHViaWETH | See [deployedContracts.ts](packages/nextjs/contracts/deployedContracts.ts) |

### Network-Specific Features

#### Base Sepolia Features

- ✅ ERC20 transfers
- ✅ Aave V3 flash loan rebalancing
- ✅ Aave V3 position closing
- ✅ MockUSDC for testing
- ✅ Sub-2-second block times
- ✅ <$0.01 gas costs

#### Sepolia Features

- ✅ Bridge to Base Sepolia
- ✅ Bridge to OP Sepolia
- ✅ WETH unwrapping
- ✅ Dual L2 deposits

---

## 📊 Performance Metrics

| Operation                   | Gas  | Time  | Cost (1 gwei) | User Cost        |
| --------------------------- | ---- | ----- | ------------- | ---------------- |
| Register Chip               | 150k | ~30s  | 0.00015 ETH   | Paid once        |
| Configure Action            | 80k  | ~30s  | 0.00008 ETH   | Paid once        |
| Execute ERC20 Transfer      | 130k | ~3s   | 0.00013 ETH   | **$0 (relayed)** |
| Aave Rebalance (Flash Loan) | 1.5M | ~60s  | 0.0015 ETH    | **$0 (relayed)** |
| Bridge to 2 L2s             | 3M   | ~2min | 0.003 ETH     | **$0 (relayed)** |

**Key Insight**: Users pay setup costs once, then execute unlimited actions gaslessly.

---

## 🔒 Security Model

### Multi-Layer Validation

```
┌────────────────────────────────────────────────────────────┐
│               Security Validation Layers                    │
└────────────────────────────────────────────────────────────┘

Request from User
       │
       ▼
┌─────────────────────┐
│ Layer 1: Signature  │
│ - EIP-712 format    │
│ - Recover chip addr │
│ - Verify signature  │
└──────┬──────────────┘
       │ ✅ Valid signature
       ▼
┌─────────────────────┐
│ Layer 2: Ownership  │
│ - registry.hasChip()│
│ - owner → chip map  │
│ - Bidirectional     │
└──────┬──────────────┘
       │ ✅ Owner has chip
       ▼
┌─────────────────────┐
│ Layer 3: Timestamp  │
│ - Not in future     │
│ - Within 5 min      │
│ - Prevents stale    │
└──────┬──────────────┘
       │ ✅ Fresh authorization
       ▼
┌─────────────────────┐
│ Layer 4: Nonce      │
│ - Check unused      │
│ - Mark used         │
│ - Replay protection │
└──────┬──────────────┘
       │ ✅ Unique transaction
       ▼
┌─────────────────────┐
│ Layer 5: Execution  │
│ - ReentrancyGuard   │
│ - target.call()     │
│ - Return success    │
└─────────────────────┘
       │
       ▼
   ✅ Transaction executes
```

### Security Features

| Feature                    | Implementation                                                                | Purpose                      |
| -------------------------- | ----------------------------------------------------------------------------- | ---------------------------- | --------------------- | ----------------------- |
| **Replay Protection**      | `mapping(bytes32 => bool) usedNonces`                                         | Prevent signature reuse      |
| **Timestamp Validation**   | `require(timestamp <= block.timestamp && block.timestamp - timestamp <= 300)` | Prevent stale signatures     |
| **Ownership Verification** | `require(registry.hasChip(owner, chip))`                                      | Ensure chip belongs to owner |
| **ReentrancyGuard**        | OpenZeppelin protection                                                       | Prevent reentrancy attacks   |
| **Access Control**         | `require(msg.sender == PROTOCOL                                               |                              | msg.sender == owner)` | Limit extension callers |
| **Secure Element**         | HaLo chip private key never leaves chip                                       | Hardware security            |

---

## 🛠 Technology Stack

### Smart Contracts

- **Foundry** - Development framework
- **Solidity** ^0.8.19
- **OpenZeppelin** - EIP712, ECDSA, ReentrancyGuard, Ownable
- **Aave V3** - Flash loans (Base Sepolia: `0x8bAB6d1b75f19e9eD9fCe8b9BD338844fF79aE27`)
- **Uniswap V2** - Token swaps

### Frontend

- **Next.js** 15 (App Router)
- **React** 19
- **TypeScript** 5
- **Wagmi** 2.16 - React hooks for Ethereum
- **Viem** 2.34 - TypeScript Ethereum library
- **RainbowKit** 2.2 - Wallet connection
- **@arx-research/libhalo** 1.3.2 - NFC chip communication

### UI/UX

- **TailwindCSS** 4 - Utility-first CSS
- **DaisyUI** 5 - Component library
- **Lucide React** - Icon library
- **Glassmorphism** design aesthetic

### Infrastructure

- **Base Sepolia** - L2 deployment (2s blocks, <$0.01 gas)
- **Optimism Sepolia** - L2 deployment
- **Ethereum Sepolia** - L1 deployment (bridge base)
- **Alchemy** - RPC provider (optional)

### Hardware

- **Arx HaLo NFC Chips** - Secure element with EIP-712 signing
- **Web NFC API** - Browser-based NFC reading (Android Chrome)

---

## 🚀 Getting Started

### Requirements

- **Node.js** >= 22.14.0
- **npm** or **yarn**
- **MetaMask** or compatible Web3 wallet
- **NFC-capable mobile device** (Android recommended)
- **Arx HaLo NFC chip** ([order here](https://arx.org/))

### Installation

```bash
# Clone repository
git clone https://github.com/0xgeorgemathew/tap-that-x.git
cd tap-that-x

# Install dependencies
npm install
```

### Environment Setup

Create `.env` file in `packages/nextjs/`:

```env
# Relayer account (must be funded with testnet ETH)
RELAYER_PRIVATE_KEY=0x...

# Alchemy API key (optional, improves RPC reliability)
ALCHEMY_API_KEY=...

# Or use public name
NEXT_PUBLIC_ALCHEMY_API_KEY=...
```

**Fund Relayer Account**:

1. Generate new wallet or use existing private key
2. Get testnet ETH from [Base Sepolia Faucet](https://www.alchemy.com/faucets/base-sepolia)
3. Add private key to `.env`

### Run Locally

```bash
# Start Next.js development server
npm run start

# Visit http://localhost:3000
```

### Testing

```bash
# Run Foundry tests
npm run foundry:test

# Run with verbosity
npm run foundry:test -- -vvv

# Test specific contract
npm run foundry:test -- --match-contract TapThatXTest
```

**Test Coverage**:

- ✅ Chip registration
- ✅ ERC20 authorized calls
- ✅ Nonce replay protection
- ✅ Timestamp expiration
- ✅ Ownership validation
- ✅ Aave rebalancing
- ✅ Flash loan calculations

### Deploy Contracts

```bash
# Deploy to Base Sepolia
npm run deploy

# Deploy to Sepolia (bridge testing)
npm run deploy -- --network sepolia
```

**Deployment Script**: [`packages/foundry/script/Deploy.s.sol`](packages/foundry/script/Deploy.s.sol)

**Deployment Order**:

1. TapThatXRegistry (no dependencies)
2. TapThatXProtocol (requires Registry)
3. TapThatXConfiguration (requires Registry)
4. TapThatXExecutor (requires Protocol + Configuration)
5. Extensions (network-specific)

---

## 📖 Usage Guide

### 1. Register Your Chip

```
1. Navigate to /register
2. Click "Start Registration"
3. Tap chip to detect address (2-3 sec)
4. Tap again to authorize registration (2-3 sec)
5. Confirm transaction in wallet (5-10 sec)
✅ Chip registered on-chain
```

### 2. Approve Token Spending (One-Time)

```
1. Navigate to /approve
2. Click "Approve USDC Spending"
3. Confirm in wallet
✅ Protocol can spend your USDC (you control via allowance)
```

### 3. Configure Actions

```
1. Navigate to /configure
2. Select your registered chip
3. Choose action template:
   - ERC20 Transfer
   - Aave Rebalance
   - Bridge ETH
4. Enter parameters (recipient, amount, etc.)
5. Save configuration on-chain
✅ Chip now executes this action on tap
```

### 4. Execute by Tapping

```
1. Navigate to /execute
2. Tap chip to detect (2 sec)
3. Tap again to authorize (2 sec)
4. Transaction executes gaslessly (1 sec)
✅ Action completed, no wallet popup needed
```

---

## 🧪 Testing Guide

### Local Testing

```bash
# 1. Start local Foundry chain
npm run chain

# 2. Deploy contracts locally
npm run deploy -- --network localhost

# 3. Start frontend
npm run start

# 4. Test with mock chip address
# Use any address as "chip" for local testing
```

### Testnet Testing

```bash
# 1. Deploy to Base Sepolia
npm run deploy

# 2. Fund relayer account
# Get ETH from https://www.alchemy.com/faucets/base-sepolia

# 3. Get HaLo chip
# Order from https://arx.org/

# 4. Test full flow
# register → approve → configure → execute
```

---

## 🔮 Roadmap

### ✅ Current Features (v1.0)

- [x] NFC chip registration with EIP-712
- [x] Generic executeAuthorizedCall for any contract
- [x] Gasless execution via relay
- [x] ERC20 token transfers
- [x] Aave V3 flash loan rebalancing
- [x] Aave V3 position closing
- [x] Cross-chain bridging (Sepolia → Base/OP)
- [x] Chain-agnostic chip signatures
- [x] Dynamic gas limit detection
- [x] Mobile-first UI with glassmorphism

### 🚧 In Progress

- [ ] Mainnet deployment
- [ ] Additional DeFi integrations (Uniswap V3, Compound)
- [ ] Multi-action batching (execute multiple actions in one tap)
- [ ] Spending limits per chip
- [ ] Emergency pause functionality

### 🔮 Future Enhancements

- [ ] **Avail Nexus Integration** - Cross-chain payments with unified liquidity
- [ ] **Merchant Terminals** - Physical POS systems accepting stablecoin payments
- [ ] **NFT Ticketing** - Tap-to-claim POAPs and event tickets
- [ ] **DAO Voting** - Physical presence voting with chips
- [ ] **DCA Strategies** - Automated dollar-cost averaging via taps
- [ ] **Yield Optimization** - Auto-rebalance across protocols
- [ ] **Limit Orders** - DEX limit orders with tap triggers

---

## 🤝 Contributing

Contributions welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

### Development Workflow

```bash
# 1. Fork repository
# 2. Create feature branch
git checkout -b feature/amazing-feature

# 3. Make changes
# 4. Run tests
npm run foundry:test

# 5. Commit changes
git commit -m "Add amazing feature"

# 6. Push to branch
git push origin feature/amazing-feature

# 7. Open Pull Request
```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Arx Research** for HaLo NFC chips and libhalo library
- **Base** for fast, cheap L2 infrastructure
- **Optimism** for L2StandardBridge specification
- **Aave** for V3 flash loan functionality
- **Scaffold-ETH** for development framework
- **OpenZeppelin** for battle-tested smart contract libraries

---

## 📞 Contact

- **Twitter**: [@0xgeorgemathew](https://twitter.com/0xgeorgemathew)
- **GitHub**: [@0xgeorgemathew](https://github.com/0xgeorgemathew)
- **Project**: [TapThat X](https://github.com/0xgeorgemathew/tap-that-x)

---

<div align="center">

**Built with ❤️ for ETHOnline 2025 Hackathon**

_Making blockchain physical, one tap at a time_

</div>
