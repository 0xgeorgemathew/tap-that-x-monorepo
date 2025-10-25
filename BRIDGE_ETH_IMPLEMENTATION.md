# Bridge ETH Implementation Guide

## ⚠️ CRITICAL: BREAKING CHANGES

**This implementation requires contract redeployment and will break existing functionality.**

### What Will Break

1. ❌ **ALL existing user configurations will be LOST**
   - Storage layout changes (adding `value` field to `ActionConfig`)
   - Old configurations cannot be read with new ABI
   - Users will see errors or garbage data

2. ❌ **Users MUST reconfigure ALL chips after deployment**
   - Chip registrations are preserved (no re-registration needed)
   - Only action configurations need to be redone

3. ❌ **Frontend code breaks until ALL files are updated**
   - 8 files require modifications (listed below)
   - App will not function until all changes are deployed

### What Won't Break

✅ **Chip registrations** - TapThatXRegistry unchanged, all registered chips preserved
✅ **TapThatXProtocol** - Already supports ETH value, no changes needed
✅ **Aave Rebalancer extension** - Unaffected, continues to work normally

---

## Migration Checklist

### Before Deployment

- [ ] **Notify all users** of planned downtime and breaking changes
- [ ] **Backup existing configurations**: Users should screenshot/write down:
  - Token addresses
  - Recipient addresses
  - Transfer amounts
  - Chip addresses
- [ ] **Fund relayer wallet** with sufficient ETH for testing (0.5+ ETH recommended)

### After Deployment

- [ ] Users must **reconfigure all chip actions** via `/configure` page
- [ ] Test existing ERC20 transfers still work (with `value: 0n`)
- [ ] Test Aave Rebalancer still works (with `value: 0n`)
- [ ] Test new bridge functionality with small amounts (0.001 ETH)

---

## Overview

This document outlines the implementation for bridging ETH from Sepolia to Base Sepolia using the TapThat X NFC chip-authorized execution platform.

**Goal**: Enable users to configure their NFC chip to bridge ETH from Ethereum Sepolia (L1) to Base Sepolia (L2) by simply tapping their chip.

---

## Architecture Summary

### Existing L1StandardBridge Contract

**Contract Address (Sepolia)**: `0xfd0Bf71F60660E2f608ed56e1659C450eB113120`

**Target Function**:
```solidity
function bridgeETHTo(
    address _to,           // Recipient address on Base Sepolia
    uint32 _minGasLimit,   // Minimum gas limit for L2 execution
    bytes _extraData       // Additional data (can be empty)
) external payable;
```

**Key Requirements**:
- Must send ETH value with transaction (the amount to bridge)
- Transaction sender pays L1 gas fees
- Bridged ETH appears on Base Sepolia at recipient address

---

## Complete File Modification List

### Smart Contracts (Require Redeployment)

1. ✅ [TapThatXConfiguration.sol](packages/foundry/contracts/core/TapThatXConfiguration.sol) - Add `value` field
2. ✅ [TapThatXExecutor.sol](packages/foundry/contracts/core/TapThatXExecutor.sol) - Make payable, forward value

### Frontend Files (Must Update Before Deployment)

3. ✅ [actionTemplates.ts](packages/nextjs/utils/actionTemplates.ts) - Update interface, add bridge template, update ALL existing templates
4. ✅ [configure/page.tsx](packages/nextjs/app/configure/page.tsx) - Add bridge UI, update setConfiguration call
5. ✅ [execute/page.tsx](packages/nextjs/app/execute/page.tsx) - Update type cast, display value, pass to relay
6. ✅ [approve/page.tsx](packages/nextjs/app/approve/page.tsx) - Update type cast
7. ✅ [useGaslessRelay.ts](packages/nextjs/hooks/useGaslessRelay.ts) - Add value parameter
8. ✅ [api/relay-execute-tap/route.ts](packages/nextjs/app/api/relay-execute-tap/route.ts) - Forward value to writeContract

---

## Implementation Changes Required

### Phase 1: Smart Contract Updates

#### 1.1 TapThatXConfiguration.sol

**File**: [packages/foundry/contracts/core/TapThatXConfiguration.sol](packages/foundry/contracts/core/TapThatXConfiguration.sol)

**Current State** (Lines 12-17):
```solidity
struct ActionConfig {
    address targetContract;
    bytes staticCallData;
    string description;
    bool isActive;
}
```

**Required Changes**:
```solidity
struct ActionConfig {
    address targetContract;
    bytes staticCallData;
    uint256 value;          // NEW: ETH value to send with call
    string description;
    bool isActive;
}

function setConfiguration(
    address chip,
    address targetContract,
    bytes calldata staticCallData,
    uint256 value,              // NEW: ETH amount parameter
    string calldata description
) external {
    require(chip != address(0), "Invalid chip address");
    require(targetContract != address(0), "Invalid target contract");
    require(staticCallData.length > 0, "Empty callData");
    require(registry.hasChip(msg.sender, chip), "Not chip owner");

    configurations[msg.sender][chip] = ActionConfig({
        targetContract: targetContract,
        staticCallData: staticCallData,
        value: value,           // NEW: Store ETH value
        description: description,
        isActive: true
    });

    emit ConfigurationSet(msg.sender, chip, targetContract, description);
}
```

---

#### 1.2 TapThatXExecutor.sol

**File**: [packages/foundry/contracts/core/TapThatXExecutor.sol](packages/foundry/contracts/core/TapThatXExecutor.sol)

**Current State** (Lines 40-68):
```solidity
function executeTap(
    address owner,
    address chip,
    bytes memory chipSignature,
    uint256 timestamp,
    bytes32 nonce
) external nonReentrant returns (bool success, bytes memory returnData) {
    require(owner != address(0), "Invalid owner");
    require(chip != address(0), "Invalid chip");

    TapThatXConfiguration.ActionConfig memory config = configuration.getConfiguration(owner, chip);

    require(config.targetContract != address(0), "No configuration exists");
    require(config.isActive, "Configuration is inactive");

    (success, returnData) = protocol.executeAuthorizedCall(
        owner,
        config.targetContract,
        config.staticCallData,
        0,  // ❌ HARDCODED - BREAKS ETH BRIDGING
        chipSignature,
        timestamp,
        nonce
    );

    emit TapExecuted(owner, chip, config.targetContract, nonce, success, config.description);

    return (success, returnData);
}
```

**Required Changes**:
```solidity
function executeTap(
    address owner,
    address chip,
    bytes memory chipSignature,
    uint256 timestamp,
    bytes32 nonce
) external payable nonReentrant returns (bool success, bytes memory returnData) {  // ✅ Added payable
    require(owner != address(0), "Invalid owner");
    require(chip != address(0), "Invalid chip");

    TapThatXConfiguration.ActionConfig memory config = configuration.getConfiguration(owner, chip);

    require(config.targetContract != address(0), "No configuration exists");
    require(config.isActive, "Configuration is inactive");
    require(msg.value >= config.value, "Insufficient ETH sent");  // ✅ NEW: Validate ETH

    (success, returnData) = protocol.executeAuthorizedCall{value: config.value}(  // ✅ Forward ETH
        owner,
        config.targetContract,
        config.staticCallData,
        config.value,  // ✅ Pass config value instead of 0
        chipSignature,
        timestamp,
        nonce
    );

    emit TapExecuted(owner, chip, config.targetContract, nonce, success, config.description);

    return (success, returnData);
}
```

---

### Phase 2: Action Templates Update

#### 2.1 Update ActionTemplate Interface

**File**: [packages/nextjs/utils/actionTemplates.ts](packages/nextjs/utils/actionTemplates.ts)

**Current Interface** (Line 7-13):
```typescript
export interface ActionTemplate {
  id: string;
  name: string;
  description: string;
  category: "payment" | "defi" | "custom";
  buildCallData: (params: any) => { target: `0x${string}`; callData: `0x${string}` };  // ❌ Missing value
}
```

**Required Changes**:
```typescript
export interface ActionTemplate {
  id: string;
  name: string;
  description: string;
  category: "payment" | "defi" | "custom";
  buildCallData: (params: any) => {
    target: `0x${string}`;
    callData: `0x${string}`;
    value?: bigint;  // ✅ NEW: Optional ETH value
  };
}
```

---

#### 2.2 Update ALL Existing Templates

**CRITICAL**: All templates must return `value` field (even if `0n`) to maintain compatibility.

**ERC20 Transfer Template** (Lines 61-78):
```typescript
export const erc20TransferTemplate: ActionTemplate = {
  id: "erc20-transfer",
  name: "ERC20 Transfer",
  description: "Send any ERC20 token to a recipient",
  category: "payment",
  buildCallData: (params: { tokenAddress: `0x${string}`; from: `0x${string}`; to: `0x${string}`; amount: bigint }) => {
    const callData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "transferFrom",
      args: [params.from, params.to, params.amount],
    });

    return {
      target: params.tokenAddress,
      callData,
      value: 0n,  // ✅ NEW: No ETH for ERC20 transfers
    };
  },
};
```

**Uniswap Swap Template** (Lines 84-108):
```typescript
export const uniswapSwapTemplate: ActionTemplate = {
  id: "uniswap-swap",
  name: "Uniswap Token Swap",
  description: "Swap tokens on Uniswap",
  category: "defi",
  buildCallData: (params: {
    routerAddress: `0x${string}`;
    amountIn: bigint;
    amountOutMin: bigint;
    path: `0x${string}`[];
    to: `0x${string}`;
    deadline: bigint;
  }) => {
    const callData = encodeFunctionData({
      abi: UNISWAP_V2_ROUTER_ABI,
      functionName: "swapExactTokensForTokens",
      args: [params.amountIn, params.amountOutMin, params.path, params.to, params.deadline],
    });

    return {
      target: params.routerAddress,
      callData,
      value: 0n,  // ✅ NEW: No ETH for token swaps
    };
  },
};
```

**Aave Rebalance Template** (Lines 154-186):
```typescript
export const aaveRebalanceTemplate: ActionTemplate = {
  id: "aave-rebalance",
  name: "Aave Position Rebalancer",
  description: "Rebalance Aave position to target health factor (auto-calculates flash loan)",
  category: "defi",
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

    return {
      target: params.rebalancerAddress,
      callData,
      value: 0n,  // ✅ NEW: No ETH for rebalancer (uses flash loans)
    };
  },
};
```

**Custom Action Template** (Lines 114-125):
```typescript
export const customActionTemplate: ActionTemplate = {
  id: "custom",
  name: "Custom Action",
  description: "Custom contract interaction (advanced)",
  category: "custom",
  buildCallData: (params: { target: `0x${string}`; callData: `0x${string}`; value?: bigint }) => {
    return {
      target: params.target,
      callData: params.callData,
      value: params.value || 0n,  // ✅ NEW: Optional value for custom actions
    };
  },
};
```

---

#### 2.3 Add Bridge ETH Template

**Add AFTER existing templates, BEFORE actionTemplates array**:

```typescript
// L1StandardBridge ABI (only the function we need)
const L1_STANDARD_BRIDGE_ABI = [
  {
    name: "bridgeETHTo",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "_to", type: "address" },
      { name: "_minGasLimit", type: "uint32" },
      { name: "_extraData", type: "bytes" }
    ],
    outputs: []
  }
] as const;

/**
 * Bridge ETH Template
 * Bridge ETH from Sepolia to Base Sepolia via L1StandardBridge
 */
export const bridgeETHTemplate: ActionTemplate = {
  id: "bridge-eth-sepolia-to-base",
  name: "Bridge ETH to Base Sepolia",
  description: "Bridge ETH from Ethereum Sepolia to Base Sepolia L2",
  category: "defi",
  buildCallData: (params: {
    recipientAddress: `0x${string}`;
    ethAmount: bigint;  // In wei
    minGasLimit?: number;
  }) => {
    const callData = encodeFunctionData({
      abi: L1_STANDARD_BRIDGE_ABI,
      functionName: "bridgeETHTo",
      args: [
        params.recipientAddress,
        params.minGasLimit || 200000,  // Default 200k gas on L2
        "0x" as `0x${string}`  // Empty extraData
      ]
    });

    return {
      target: "0xfd0Bf71F60660E2f608ed56e1659C450eB113120" as `0x${string}`,  // L1StandardBridge on Sepolia
      callData,
      value: params.ethAmount  // ✅ ETH amount to bridge
    };
  },
};
```

**Update actionTemplates array** (Line 191):
```typescript
export const actionTemplates: ActionTemplate[] = [
  erc20TransferTemplate,
  uniswapSwapTemplate,
  aaveRebalanceTemplate,
  bridgeETHTemplate,  // ✅ NEW: Add bridge template
  customActionTemplate,
];
```

---

### Phase 3: Frontend Configuration UI

#### 3.1 Update Configuration Page

**File**: [packages/nextjs/app/configure/page.tsx](packages/nextjs/app/configure/page.tsx)

**Add State for Bridge** (after line 43):
```typescript
// Form fields for Bridge ETH
const [bridgeRecipient, setBridgeRecipient] = useState<string>("");
const [bridgeAmount, setBridgeAmount] = useState<string>("0.001");
```

**Update setConfiguration Call** (Lines 203-209):

**Current Code**:
```typescript
writeContract(
  {
    address: configurationAddress,
    abi: configurationAbi,
    functionName: "setConfiguration",
    args: [
      selectedChip as `0x${string}`,
      callDataResult.target,
      callDataResult.callData,
      finalDescription  // ❌ MISSING VALUE PARAMETER
    ],
  },
  // ...
);
```

**Required Changes**:
```typescript
writeContract(
  {
    address: configurationAddress,
    abi: configurationAbi,
    functionName: "setConfiguration",
    args: [
      selectedChip as `0x${string}`,
      callDataResult.target,
      callDataResult.callData,
      callDataResult.value || 0n,  // ✅ NEW: Pass value from template
      finalDescription
    ],
  },
  // ...
);
```

**Add Bridge UI** (AFTER Aave rebalancer UI, around line 493):

```typescript
{/* Bridge ETH Fields */}
{selectedTemplate === "bridge-eth-sepolia-to-base" && (
  <div className="space-y-4">
    <div className="glass-alert">
      <AlertCircle className="h-5 w-5 text-info" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-base-content">Bridge to Base Sepolia</p>
        <p className="text-xs text-base-content/70 mt-1">
          Bridge takes ~10 minutes. ETH will appear on Base Sepolia L2.
        </p>
      </div>
    </div>

    <div>
      <label className="block text-sm font-medium mb-2">
        Recipient Address (Base Sepolia)
      </label>
      <input
        type="text"
        placeholder="0x..."
        value={bridgeRecipient}
        onChange={(e) => setBridgeRecipient(e.target.value)}
        className="w-full px-4 py-2 border rounded glass-input"
      />
      <p className="text-xs text-base-content/50 mt-1">
        Address that will receive ETH on Base Sepolia L2
      </p>
    </div>

    <div>
      <label className="block text-sm font-medium mb-2">
        ETH Amount to Bridge
      </label>
      <input
        type="text"
        placeholder="0.001"
        value={bridgeAmount}
        onChange={(e) => setBridgeAmount(e.target.value)}
        className="w-full px-4 py-2 border rounded glass-input"
      />
      <p className="text-xs text-base-content/50 mt-1">
        Amount in ETH (e.g., 0.001 = 0.001 ETH)
      </p>
    </div>

    <div className="glass-alert">
      <AlertCircle className="h-5 w-5 text-warning" />
      <p className="text-xs text-base-content/70">
        ⚠️ This amount will be bridged EVERY time you tap your chip.
        Start with a small test amount (0.001 ETH).
      </p>
    </div>

    <div className="glass-alert">
      <AlertCircle className="h-5 w-5 text-warning" />
      <p className="text-xs text-base-content/70">
        ⚠️ Relayer must have sufficient ETH balance to front the bridge amount.
        Contact admin if execution fails.
      </p>
    </div>
  </div>
)}
```

**Update handleSaveConfiguration** (around line 164):

Add bridge case BEFORE the final description block:

```typescript
} else if (template.id === "bridge-eth-sepolia-to-base") {
  if (!bridgeRecipient || !bridgeAmount) {
    throw new Error("Please fill in all fields");
  }

  const ethAmountWei = parseEther(bridgeAmount);

  callDataResult = template.buildCallData({
    recipientAddress: bridgeRecipient as `0x${string}`,
    ethAmount: ethAmountWei,
    minGasLimit: 200000
  });
}
```

**Update final description** (around line 189-198):

```typescript
let finalDescription = description;
if (!finalDescription) {
  if (template.id === "erc20-transfer") {
    finalDescription = `Send ${amount} tokens to ${recipient.slice(0, 6)}...${recipient.slice(-4)}`;
  } else if (template.id === "aave-rebalance") {
    finalDescription = `Rebalance Aave position to HF ${targetHealthFactor}`;
  } else if (template.id === "bridge-eth-sepolia-to-base") {  // ✅ NEW
    finalDescription = `Bridge ${bridgeAmount} ETH to ${bridgeRecipient.slice(0, 6)}...${bridgeRecipient.slice(-4)} on Base`;
  } else {
    finalDescription = "Custom action";
  }
}
```

---

### Phase 4: Execution Flow Updates

#### 4.1 Update Execute Page Type Cast

**File**: [packages/nextjs/app/execute/page.tsx](packages/nextjs/app/execute/page.tsx)

**Current Type Cast** (Lines 80-85):
```typescript
const config = (await publicClient.readContract({
  address: CONFIGURATION_ADDRESS,
  abi: contracts.TapThatXConfiguration.abi,
  functionName: "getConfiguration",
  args: [address, detectedChipAddress],
})) as {
  targetContract: string;
  staticCallData: string;
  description: string;
  isActive: boolean;  // ❌ MISSING VALUE FIELD
};
```

**Required Changes**:
```typescript
const config = (await publicClient.readContract({
  address: CONFIGURATION_ADDRESS,
  abi: contracts.TapThatXConfiguration.abi,
  functionName: "getConfiguration",
  args: [address, detectedChipAddress],
})) as {
  targetContract: string;
  staticCallData: string;
  value: bigint;       // ✅ NEW
  description: string;
  isActive: boolean;
};
```

**Display Value in Preview** (around line 227):

Find the action preview display and add value display:

```typescript
{actionPreview && (
  <div className="border rounded p-4 glass-card">
    <h3 className="font-bold">Ready to Execute</h3>
    <p>{actionPreview.description}</p>
    <p className="text-sm text-base-content/70">
      Target: {actionPreview.targetContract.slice(0, 10)}...{actionPreview.targetContract.slice(-8)}
    </p>
    {actionPreview.value && actionPreview.value > 0n && (  // ✅ NEW
      <p className="text-sm font-semibold text-success mt-2">
        💰 ETH Value: {formatEther(actionPreview.value)} ETH
      </p>
    )}
  </div>
)}
```

**Pass Value to Relay** (Line 146):

**Current**:
```typescript
const result = await relayExecuteTap({
  owner: address,
  chip: detectedChipAddress,
  chipSignature: chipSig.signature,
  timestamp,
  nonce,
  // ❌ MISSING VALUE
});
```

**Required**:
```typescript
const result = await relayExecuteTap({
  owner: address,
  chip: detectedChipAddress,
  chipSignature: chipSig.signature,
  timestamp,
  nonce,
  value: config.value  // ✅ NEW: Pass ETH value
});
```

**Add Import** (top of file):
```typescript
import { formatEther } from "viem";
```

---

#### 4.2 Update Approve Page Type Cast

**File**: [packages/nextjs/app/approve/page.tsx](packages/nextjs/app/approve/page.tsx)

**Current Type Cast** (Lines 67-72):
```typescript
const config = (await publicClient.readContract({
  address: contracts.TapThatXConfiguration.address,
  abi: contracts.TapThatXConfiguration.abi,
  functionName: "getConfiguration",
  args: [address, chip],
})) as {
  targetContract: string;
  staticCallData: string;
  description: string;
  isActive: boolean;  // ❌ MISSING VALUE FIELD
};
```

**Required Changes**:
```typescript
const config = (await publicClient.readContract({
  address: contracts.TapThatXConfiguration.address,
  abi: contracts.TapThatXConfiguration.abi,
  functionName: "getConfiguration",
  args: [address, chip],
})) as {
  targetContract: string;
  staticCallData: string;
  value: bigint;       // ✅ NEW
  description: string;
  isActive: boolean;
};
```

**Note**: Approval page only uses `targetContract` field, so this change is for type safety only. Functionality is unaffected.

---

#### 4.3 Update Relay Hook

**File**: [packages/nextjs/hooks/useGaslessRelay.ts](packages/nextjs/hooks/useGaslessRelay.ts)

**Current Interface** (Lines 6-17):
```typescript
const relayExecuteTap = async (executeData: {
  owner: string;
  chip: string;
  chipSignature: string;
  timestamp: number;
  nonce: string;
  // ❌ MISSING VALUE
}) => {
  const response = await fetch("/api/relay-execute-tap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...executeData, chainId }),
  });
  // ...
};
```

**Required Changes**:
```typescript
const relayExecuteTap = async (executeData: {
  owner: string;
  chip: string;
  chipSignature: string;
  timestamp: number;
  nonce: string;
  value?: bigint;  // ✅ NEW: Optional ETH value
}) => {
  const response = await fetch("/api/relay-execute-tap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...executeData,
      value: executeData.value?.toString(),  // ✅ Serialize BigInt
      chainId
    }),
  });
  // ...
};
```

---

#### 4.4 Update Relay API

**File**: [packages/nextjs/app/api/relay-execute-tap/route.ts](packages/nextjs/app/api/relay-execute-tap/route.ts)

**Extract Value from Request** (Line 16):

**Current**:
```typescript
const { owner, chip, chipSignature, timestamp, nonce, chainId } = body;
```

**Required**:
```typescript
const { owner, chip, chipSignature, timestamp, nonce, chainId, value } = body;
```

**Add Balance Check** (BEFORE writeContract call, around line 65):

```typescript
// Check relayer balance if value is being sent
const valueToSend = value ? BigInt(value) : 0n;
if (valueToSend > 0n) {
  const balance = await client.getBalance({ address: account.address });
  const estimatedGas = BigInt(1_500_000) * BigInt(await client.getGasPrice());
  const totalNeeded = valueToSend + estimatedGas;

  if (balance < totalNeeded) {
    return NextResponse.json(
      {
        error: `Insufficient relayer balance. Need ${formatEther(totalNeeded)} ETH (${formatEther(valueToSend)} bridge + ${formatEther(estimatedGas)} gas), have ${formatEther(balance)} ETH`
      },
      { status: 500 }
    );
  }
}
```

**Forward Value to writeContract** (Lines 70-82):

**Current**:
```typescript
const hash = await client.writeContract({
  address: contracts.TapThatXExecutor.address,
  abi: contracts.TapThatXExecutor.abi,
  functionName: "executeTap",
  args: [
    owner as `0x${string}`,
    chip as `0x${string}`,
    chipSignature as `0x${string}`,
    BigInt(timestamp),
    nonce as `0x${string}`,
  ],
  gas: isAaveRebalancer ? BigInt(1_500_000) : undefined,
  // ❌ MISSING VALUE
});
```

**Required**:
```typescript
const hash = await client.writeContract({
  address: contracts.TapThatXExecutor.address,
  abi: contracts.TapThatXExecutor.abi,
  functionName: "executeTap",
  args: [
    owner as `0x${string}`,
    chip as `0x${string}`,
    chipSignature as `0x${string}`,
    BigInt(timestamp),
    nonce as `0x${string}`,
  ],
  value: valueToSend,  // ✅ NEW: Forward ETH value
  gas: isAaveRebalancer ? BigInt(1_500_000) : undefined,
});
```

**Add Import** (top of file):
```typescript
import { formatEther } from "viem";
```

---

## Deployment Instructions

### Step 1: Update Smart Contracts

1. **Make changes** to `TapThatXConfiguration.sol` and `TapThatXExecutor.sol` as outlined above

2. **Compile contracts**:
```bash
cd packages/foundry
forge build
```

3. **Deploy to Sepolia**:
```bash
forge script script/Deploy.s.sol \
  --rpc-url sepolia \
  --broadcast \
  --verify
```

4. **Update contract addresses** in [packages/nextjs/contracts/deployedContracts.ts](packages/nextjs/contracts/deployedContracts.ts):
```typescript
11155111: {  // Sepolia
  TapThatXConfiguration: {
    address: "0x...",  // NEW ADDRESS
    abi: [...]
  },
  TapThatXExecutor: {
    address: "0x...",  // NEW ADDRESS
    abi: [...]
  },
  // TapThatXRegistry - UNCHANGED (preserve chip registrations)
  // TapThatXProtocol - UNCHANGED (already supports ETH)
  // TapThatXAaveRebalancer - UNCHANGED (no modifications needed)
}
```

---

### Step 2: Update Frontend Code

**Update ALL 6 frontend files in order**:

1. ✅ **actionTemplates.ts** - Update interface, all templates, add bridge template
2. ✅ **configure/page.tsx** - Update setConfiguration call, add bridge UI
3. ✅ **execute/page.tsx** - Update type cast, add value display, pass to relay
4. ✅ **approve/page.tsx** - Update type cast
5. ✅ **useGaslessRelay.ts** - Add value parameter
6. ✅ **relay API** - Extract value, check balance, forward to writeContract

**Test TypeScript compilation**:
```bash
cd packages/nextjs
npm run build
```

---

### Step 3: Fund Relayer Wallet

The relayer must have sufficient ETH on Sepolia to:
- Pay gas fees for executing transactions (~0.003 ETH per tx)
- **Front the ETH for bridging** (temporarily, until user repayment mechanism is added)

**Get Sepolia ETH**:
- Faucet: https://sepoliafaucet.com/
- Recommended: Fund with **0.5 ETH minimum** for testing

**Check relayer balance**:
```bash
cast balance <RELAYER_ADDRESS> --rpc-url sepolia
```

---

### Step 4: Deploy to Production

1. **Deploy Next.js app**:
```bash
cd packages/nextjs
npm run build
npm run start
```

2. **Set environment variables**:
```bash
RELAYER_PRIVATE_KEY=0x...
ALCHEMY_API_KEY=...
```

---

## Testing Checklist

### Pre-Deployment Tests

- [ ] Smart contracts compile with `forge build`
- [ ] Frontend compiles with `npm run build`
- [ ] No TypeScript errors
- [ ] ActionConfig struct has `value` field
- [ ] executeTap is `payable`
- [ ] All templates return `value` field

### Post-Deployment Tests (Existing Functionality)

- [ ] Register NEW chip (test registration still works)
- [ ] Configure ERC20 transfer with test token
- [ ] Execute ERC20 transfer and verify it works
- [ ] Check approval detection still works
- [ ] **Aave Rebalancer**: Configure Aave rebalance action
- [ ] **Aave Rebalancer**: Execute and verify rebalancing works
- [ ] Verify all UI pages render without errors

### Post-Deployment Tests (New Bridge Functionality)

- [ ] Configure bridge action with **0.001 ETH** (small test)
- [ ] Verify configuration stored on-chain
- [ ] Check `getConfiguration()` returns correct value
- [ ] Execute tap and confirm transaction on Sepolia
- [ ] Wait ~10 minutes for bridge finalization
- [ ] Verify ETH appears on Base Sepolia
- [ ] Check recipient balance on Base Sepolia

### Verification Commands

**Check configuration**:
```bash
cast call <CONFIGURATION_ADDRESS> \
  "getConfiguration(address,address)(address,bytes,uint256,string,bool)" \
  <OWNER_ADDRESS> <CHIP_ADDRESS> \
  --rpc-url sepolia
```

**Check bridge transaction**:
```bash
# On Sepolia
cast tx <TX_HASH> --rpc-url sepolia

# On Base Sepolia (check recipient)
cast balance <RECIPIENT_ADDRESS> --rpc-url base-sepolia
```

---

## Contract Addresses

### Sepolia Testnet (Chain ID: 11155111)

| Contract | Address | Status |
|----------|---------|--------|
| L1StandardBridge | `0xfd0Bf71F60660E2f608ed56e1659C450eB113120` | Official Base bridge (already deployed) |
| TapThatXConfiguration | *To be deployed* | ⚠️ Updated with value field |
| TapThatXExecutor | *To be deployed* | ⚠️ Updated to forward ETH |
| TapThatXProtocol | *Unchanged* | ✅ Already supports ETH |
| TapThatXRegistry | *Unchanged* | ✅ No changes needed |
| TapThatXAaveRebalancer | *Unchanged* | ✅ No changes needed |

### Base Sepolia Testnet (Chain ID: 84532)

| Contract | Address | Notes |
|----------|---------|-------|
| L2StandardBridge | `0x4200000000000000000000000000000000000010` | Receives bridged ETH |

---

## Aave Rebalancer Compatibility

### Why Aave Rebalancer is Unaffected

✅ **No changes required** to TapThatXAaveRebalancer contract
✅ **Template updated** to return `value: 0n` (flash loans, no ETH needed)
✅ **Approve page** only reads `targetContract` field (value field ignored)
✅ **Configure page** unchanged for Aave flow (no value input needed)

### Aave Rebalancer Testing

After deployment, verify Aave rebalancer still works:

1. Navigate to `/configure`
2. Select "Aave Position Rebalancer" template
3. Configure target health factor and slippage
4. Save configuration (will include `value: 0n`)
5. Execute tap and verify rebalancing completes
6. Check health factor improved

**No reconfiguration needed** if Aave action was already configured before deployment.

**Actually, users MUST reconfigure** because storage layout changed. But the process is identical to before.

---

## Example Configuration Flow

### User Journey (Bridge ETH)

1. **User navigates to /configure**
2. **Selects chip** from dropdown
3. **Selects template**: "Bridge ETH to Base Sepolia"
4. **Enters recipient address**: `0x59d4C5BE20B41139494b3F1ba2A745ad9e71B00B`
5. **Enters ETH amount**: `0.001` (test amount)
6. **Clicks "Save Configuration"**
7. **Confirms transaction** in wallet

### On-Chain Result

```solidity
configurations[userAddress][chipAddress] = ActionConfig({
    targetContract: 0xfd0Bf71F60660E2f608ed56e1659C450eB113120,  // L1StandardBridge
    staticCallData: 0x...,  // Encoded bridgeETHTo(0x59d4..., 200000, 0x)
    value: 1000000000000000,  // 0.001 ETH in wei
    description: "Bridge 0.001 ETH to 0x59d4...B00B on Base",
    isActive: true
});
```

### Execution Flow

1. **User navigates to /execute**
2. **Taps chip** (chip signs authorization)
3. **Frontend sends** to relay API with `value: 1000000000000000n`
4. **Relay API** validates balance, submits transaction with 0.001 ETH
5. **TapThatXExecutor** forwards 0.001 ETH to L1StandardBridge
6. **L1StandardBridge** locks ETH and emits bridge event
7. **Base Sepolia** mints ETH to recipient after ~10 minutes

---

## Security Considerations

### ETH Value Storage

✅ **Safe**: Value is stored on-chain in configuration
✅ **Immutable**: Cannot be changed without re-configuring
✅ **Signed**: Chip signature includes value in EIP-712 hash
❌ **Fixed Amount**: User cannot vary amount per tap (feature, not bug)

### Relayer Concerns

⚠️ **Relayer fronts ETH**: Relayer must have sufficient balance
⚠️ **No repayment mechanism**: Currently relayer loses ETH on each bridge
⚠️ **Balance monitoring**: Relayer can run out of funds quickly
💡 **Future**: Add approval mechanism for relayer to pull ETH from user

### Recommendations

1. **Start with small amounts** (0.001 ETH)
2. **Monitor relayer balance** regularly (set up alerts)
3. **Set spending limits** per chip (future feature)
4. **Add emergency pause** functionality (future feature)
5. **Consider user pre-funding** relayer wallet before bridge

---

## Known Limitations

### Current Implementation

1. **Fixed ETH amount**: Each tap sends same amount (cannot vary dynamically)
2. **No refunds**: If bridge fails on L2, ETH may be stuck
3. **Relayer costs**: Relayer pays gas + fronts ETH (no reimbursement)
4. **No validation**: User can configure amount larger than relayer balance
5. **Storage layout break**: All existing configurations lost on deployment

### Future Enhancements

- [ ] Dynamic amount input at tap time
- [ ] Relayer pulls ETH from user's wallet (requires approval)
- [ ] Spending limits per chip
- [ ] Emergency pause mechanism
- [ ] Multi-bridge support (Optimism, Arbitrum, etc.)
- [ ] Batch bridging (multiple taps → single bridge)
- [ ] User pre-funding of relayer (escrow model)

---

## Troubleshooting

### "Insufficient relayer balance"

**Cause**: Relayer wallet doesn't have enough ETH
**Solution**: Fund relayer with more Sepolia ETH

### "Configuration is inactive"

**Cause**: Configuration was toggled off
**Solution**: Call `toggleConfiguration()` to re-activate

### "Nonce already used"

**Cause**: Trying to replay same signature
**Solution**: Tap chip again to generate new signature

### "Authorization expired"

**Cause**: Signature timestamp > 5 minutes old
**Solution**: Tap chip again with fresh timestamp

### Bridge stuck on L1

**Cause**: L2 gas limit too low (rare)
**Solution**: Increase `minGasLimit` to 500000 in template

### ETH not appearing on Base Sepolia

**Cause**: Bridge takes ~10 minutes
**Solution**: Wait for bridge finalization, check https://sepolia.basescan.org/

### "No configuration found" after deployment

**Cause**: Storage layout changed, old configs lost
**Solution**: Users must reconfigure all chips via `/configure`

### Aave Rebalancer not working

**Cause**: Users must reconfigure Aave actions (storage layout changed)
**Solution**: Go to `/configure`, select Aave template, reconfigure

### TypeScript errors in frontend

**Cause**: Not all type casts updated to include `value` field
**Solution**: Check all `getConfiguration()` calls have `value: bigint` in type

---

## Reference Transaction

Your successful manual bridge transaction:

**Function**: `bridgeETHTo(address _to, uint32 _minGasLimit, bytes _extraData)`

**Parameters**:
- `_to`: `0x59d4C5BE20B41139494b3F1ba2A745ad9e71B00B`
- `_minGasLimit`: `200000`
- `_extraData`: `0x` (empty)

**Value Sent**: (Check your transaction on Etherscan)

This exact same call will be executed by TapThat X when you tap your chip, with ETH value configured in your ActionConfig.

---

## Support & Resources

- **Base Bridge Docs**: https://docs.base.org/chain/bridges-mainnet
- **Optimism Bridge Guide**: https://docs.optimism.io/app-developers/tutorials/bridging
- **TapThat X Docs**: See [CLAUDE.md](CLAUDE.md)
- **Sepolia Faucet**: https://sepoliafaucet.com/
- **Base Sepolia Explorer**: https://sepolia.basescan.org/

---

## Changelog

### v1.0.0 - Initial Implementation

**Breaking Changes**:
- ⚠️ Added `value` field to ActionConfig struct
- ⚠️ Updated `setConfiguration()` function signature
- ⚠️ Made `executeTap()` payable
- ⚠️ All existing configurations lost

**New Features**:
- ✅ Bridge ETH from Sepolia to Base Sepolia
- ✅ Value field in action configurations
- ✅ Relayer balance validation
- ✅ Bridge UI in configuration page

**Unchanged**:
- ✅ Chip registrations preserved
- ✅ TapThatXProtocol unchanged
- ✅ TapThatXAaveRebalancer unchanged

---

*Last Updated: 2025-10-25*
*Author: Claude (Tap That X Implementation)*
*Version: 1.0.0 - Breaking Changes Edition*
