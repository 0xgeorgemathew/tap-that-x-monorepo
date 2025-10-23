# TapThat X - Project Documentation

## Project Overview

**TapThat X** is an NFC chip-authorized blockchain execution platform that enables users to execute pre-configured smart contract actions by tapping NFC chips. The system supports arbitrary contract interactions, with initial focus on ERC20 token transfers.

### Core Concept
- Users register HaLo NFC chips to their wallet address
- Users configure what action happens when they tap a chip
- Users execute actions by physically tapping their chip (chip signs authorization)
- Backend relayer submits transaction on behalf of user (gasless execution)

### Architecture Layers

1. **Smart Contract Layer** - On-chain logic for registration, configuration, and execution
2. **Frontend Layer** - React/Next.js UI for user interactions
3. **Backend Relay Layer** - Gasless transaction submission service

---

## Smart Contract Architecture

All contracts located in: `packages/foundry/contracts/core/`

### TapThatXRegistry.sol
**Purpose**: Manages chip-to-owner registration and ownership verification

**Key Functions:**
- `registerChip(address chipAddress, bytes memory chipSignature)` (line 29)
  - Validates EIP-712 signature from chip proving ownership
  - Uses chain-agnostic domain separator (no chainId)
  - Stores bidirectional mapping: owner→chips and chip→owners
  - Emits `ChipRegistered` event

- `getOwnerChips(address owner)` (line 55)
  - Returns array of all chips owned by an address

- `hasChip(address owner, address chip)` (line 70)
  - Checks if specific owner has specific chip

**Storage:**
```solidity
mapping(address => address[]) private ownerToChips;      // owner => chips[]
mapping(address => address[]) private chipToOwners;      // chip => owners[]
mapping(address => mapping(address => bool)) public ownerHasChip;  // owner => chip => bool
```

**Security:**
- EIP-712 typed signatures for registration
- Chain-agnostic domain separator allows cross-chain chip reuse
- ReentrancyGuard protection

---

### TapThatXProtocol.sol
**Purpose**: Core execution engine for chip-authorized contract calls

**Key Functions:**
- `executeAuthorizedCall()` (line 45)
  - Validates chip signature via `_verifyChipAuth()` (line 103)
  - Checks chip ownership via TapThatXRegistry
  - Validates nonce hasn't been used (replay protection)
  - Executes `target.call{value}(callData)` (line 72)
  - Emits `AuthorizedCallExecuted` event

**Authorization Validation:**
```solidity
// 1. Recover chip address from signature (line 128)
address chip = TapThatXAuth.recoverChipFromCallAuth(
    _chainAgnosticDomainSeparator(),
    auth,
    signature
);

// 2. Validate timestamp (line 124)
require(TapThatXAuth.validateTimestamp(timestamp, MAX_TIMESTAMP_WINDOW), "Authorization expired");

// 3. Validate ownership (line 65)
require(registry.hasChip(owner, chip), "Owner does not have chip");
```

**Storage:**
```solidity
mapping(bytes32 => bool) public usedNonces;  // Prevents replay attacks
uint256 public constant MAX_TIMESTAMP_WINDOW = 300;  // 5 minute expiration
```

**Security:**
- Nonce-based replay protection
- Timestamp validation (5 minute window)
- ReentrancyGuard protection
- EIP-712 signature validation

---

### TapThatXConfiguration.sol
**Purpose**: On-chain storage for chip-to-action mappings

**Data Structure:**
```solidity
struct ActionConfig {
    address targetContract;   // Contract to call (e.g., USDC, Uniswap)
    bytes staticCallData;     // Pre-encoded function call with parameters
    string description;       // Human-readable description
    bool isActive;           // Enable/disable without deleting
}

mapping(address => mapping(address => ActionConfig)) public configurations;
// Structure: owner => chip => ActionConfig
```

**Key Functions:**
- `setConfiguration(address chip, address targetContract, bytes calldata staticCallData, string calldata description)` (line 38)
  - Validates caller owns chip via TapThatXRegistry
  - Stores configuration for (owner, chip) pair
  - Auto-activates configuration (isActive = true)

- `getConfiguration(address owner, address chip)` (line 85)
  - Returns ActionConfig for given owner/chip combination

- `isConfigured(address owner, address chip)` (line 93)
  - Checks if active configuration exists

- `toggleConfiguration(address chip)` (line 61)
  - Enable/disable configuration without deleting

**Security:**
- Only chip owner can set configuration
- Ownership validated via TapThatXRegistry.hasChip()

---

### TapThatXExecutor.sol
**Purpose**: Simplified execution interface - fetches config and executes via TapThatXProtocol

**Key Functions:**
- `executeTap(address owner, address chip, bytes memory chipSignature, uint256 timestamp, bytes32 nonce)` (line 40)
  - Fetches configuration from TapThatXConfiguration (line 51)
  - Validates configuration exists and is active
  - Executes via TapThatXProtocol.executeAuthorizedCall() (line 57)
  - Returns (success, returnData)

- `previewTap(address owner, address chip)` (line 76)
  - View function to preview what would be executed
  - Used by frontend to show user what will happen

- `canExecute(address owner, address chip)` (line 88)
  - Checks if tap can be executed (config exists and is active)

**Flow:**
```
TapThatXExecutor.executeTap()
  → TapThatXConfiguration.getConfiguration()
  → TapThatXProtocol.executeAuthorizedCall()
     → TapThatXAuth.recoverChipFromCallAuth()
     → TapThatXRegistry.hasChip()
     → target.call{value}(callData)
```

**Security:**
- ReentrancyGuard protection
- All validation delegated to TapThatXProtocol

---

### TapThatXAuth.sol
**Purpose**: Authentication library for EIP-712 signature verification

**Data Structures:**
```solidity
struct CallAuthorization {
    address owner;      // Chip owner (payer/executor)
    address target;     // Contract to call
    bytes callData;     // Encoded function call
    uint256 value;      // ETH value (0 for no ETH)
    uint256 timestamp;  // Authorization creation time
    bytes32 nonce;      // Unique nonce for replay protection
}
```

**Key Functions:**
- `recoverChipFromCallAuth(bytes32 domainSeparator, CallAuthorization memory auth, bytes memory signature)` (line 57)
  - Constructs EIP-712 hash from CallAuthorization struct
  - Recovers signer address from signature
  - Returns chip address that signed the authorization

- `validateTimestamp(uint256 timestamp, uint256 maxWindow)` (line 44)
  - Ensures timestamp is not in future
  - Ensures timestamp is within acceptable window (5 minutes)

**EIP-712 Type Hash:**
```solidity
bytes32 constant CALL_AUTH_TYPEHASH = keccak256(
    "CallAuthorization(address owner,address target,bytes callData,uint256 value,uint256 timestamp,bytes32 nonce)"
);
```

---

## Frontend Architecture

All pages located in: `packages/nextjs/app/`

### Key Hooks

#### useHaloChip (`packages/nextjs/hooks/useHaloChip.ts`)
**Purpose**: Interface to HaLo NFC chip hardware

**Functions:**
- `signMessage({ message, digest, format })` (line 18)
  - Prompts user to tap NFC chip
  - Calls `execHaloCmdWeb()` from @arx-research/libhalo library
  - Returns `{ address, signature }`
  - Used for chip detection (message: "init")

- `signTypedData({ domain, types, primaryType, message })` (line 61)
  - Prompts user to tap NFC chip for EIP-712 signature
  - Serializes BigInt values to strings (required by libhalo)
  - Returns `{ address, signature }`
  - Used for registration and execution authorization

**Implementation Details:**
- Uses @arx-research/libhalo library for Web NFC API
- Automatically handles BigInt serialization
- Provides loading and error states

---

#### useGaslessRelay (`packages/nextjs/hooks/useGaslessRelay.ts`)
**Purpose**: Submit transactions to gasless relay API

**Functions:**
- `relayExecuteTap({ owner, chip, chipSignature, timestamp, nonce })` (line 6)
  - Sends POST request to `/api/relay-execute-tap`
  - Includes current chainId from wagmi
  - Returns transaction hash and block number
  - Throws error if relay fails

---

### Action Templates (`packages/nextjs/utils/actionTemplates.ts`)
**Purpose**: Build callData for common DeFi operations

**Available Templates:**

1. **usdcTransferTemplate** (line 61)
   - Encodes ERC20.transferFrom(from, to, amount)
   - Returns `{ target: tokenAddress, callData }`

2. **erc20TransferTemplate** (line 84)
   - Same as USDC template but for any ERC20 token
   - Uses dynamic decimals fetching

3. **uniswapSwapTemplate** (line 107)
   - Encodes Uniswap V2 swapExactTokensForTokens()
   - For future implementation

4. **customActionTemplate** (line 137)
   - For advanced users to input raw callData

**Helper Functions:**
- `formatTokenAmount(amount: string, decimals: number)` (line 171)
  - Converts "100.00" → 100000000n (for 6 decimals)
  - Handles decimal precision

- `parseTokenAmount(amount: bigint, decimals: number)` (line 181)
  - Converts 100000000n → "100.00" (for 6 decimals)
  - Human-readable display

---

## Detailed Flow Documentation

### 1. Registration Flow

**Goal**: Link NFC chip to user's wallet address on-chain

**Starting Point**: User navigates to `/register` (`packages/nextjs/app/register/page.tsx`)

**Step-by-Step Execution:**

1. **User Initiates Registration**
   - User clicks "Start Registration" button (line 260)
   - Triggers `handleRegister()` function (line 57)

2. **Wallet Validation**
   ```typescript
   if (!address) {
       setStatusMessage("Please connect your wallet first");
       setFlowState("error");
       return;
   }
   ```
   - Checks user has connected wallet via RainbowKit
   - `address` provided by wagmi `useAccount()` hook

3. **Chip Detection**
   - Sets flow state to "reading" (line 72)
   - Prompts user: "Hold your device near the NFC chip..." (line 73)
   - Calls `signMessage({ message: "init", format: "text" })` (line 75)
   - **Hook Location**: `packages/nextjs/hooks/useHaloChip.ts:18`
   - **Hook Execution**:
     ```typescript
     const result = await execHaloCmdWeb({
         name: "sign",
         keyNo: 1,
         message: "init",
         format: "text"
     });
     ```
   - **libhalo Library**: Accesses Web NFC API, communicates with chip
   - **Returns**: `{ address: "0x...", signature: "0x..." }`
   - Chip address is derived from chip's embedded private key

4. **EIP-712 Signature for Registration**
   - Sets flow state to "signing" (line 83)
   - Prompts user: "Tap your chip again to authorize registration..." (line 84)
   - Calls `signTypedData()` (line 86)
   - **Typed Data Structure**:
     ```typescript
     {
         domain: {
             name: "TapThatXRegistry",
             version: "1",
             verifyingContract: registryAddress  // No chainId (chain-agnostic)
         },
         types: {
             ChipRegistration: [
                 { name: "owner", type: "address" },
                 { name: "chipAddress", type: "address" }
             ]
         },
         primaryType: "ChipRegistration",
         message: {
             owner: userAddress,
             chipAddress: detectedChipAddress
         }
     }
     ```
   - **Hook Location**: `packages/nextjs/hooks/useHaloChip.ts:61`
   - Chip signs the registration authorization
   - Returns EIP-712 signature

5. **Submit On-Chain Transaction**
   - Sets flow state to "confirming" (line 109)
   - Prompts user: "Please confirm the transaction in your wallet..." (line 110)
   - Calls `writeContract()` via wagmi (line 112)
   - **Contract**: TapThatXRegistry
   - **Function**: `registerChip(address chipAddress, bytes memory chipSignature)`
   - **Contract Location**: `packages/foundry/contracts/core/TapThatXRegistry.sol:29`

6. **On-Chain Validation**
   ```solidity
   // 1. Build EIP-712 digest (line 34)
   bytes32 structHash = keccak256(abi.encode(
       REGISTRATION_TYPEHASH,
       msg.sender,  // owner
       chipAddress
   ));
   bytes32 digest = keccak256(abi.encodePacked(
       "\x19\x01",
       _chainAgnosticDomainSeparator(),
       structHash
   ));

   // 2. Recover signer from signature (line 36)
   address signer = digest.recover(chipSignature);

   // 3. Validate signer matches chip address (line 38)
   require(signer == chipAddress, "Invalid chip signature");
   ```
   - Proves chip holder created the signature
   - Only the physical chip can produce valid signature

7. **Storage Updates**
   ```solidity
   // Add chip to owner's collection (line 41)
   ownerToChips[msg.sender].push(chipAddress);

   // Add owner to chip's collection (line 44)
   chipToOwners[chipAddress].push(msg.sender);

   // Mark ownership (line 47)
   ownerHasChip[msg.sender][chipAddress] = true;

   // Emit event (line 49)
   emit ChipRegistered(chipAddress, msg.sender);
   ```

8. **Transaction Confirmation**
   - Frontend waits for transaction via `useWaitForTransactionReceipt()` (line 22)
   - `useEffect` hook detects confirmation (line 49)
   - Sets flow state to "success" (line 52)
   - Displays: "Success! Chip registered on-chain." (line 53)

**Key Files:**
- Frontend: `packages/nextjs/app/register/page.tsx`
- Hook: `packages/nextjs/hooks/useHaloChip.ts`
- Contract: `packages/foundry/contracts/core/TapThatXRegistry.sol`

---

### 2. Approval Flow

**Goal**: Approve TapThatXProtocol to spend user's ERC20 tokens

**Starting Point**: User navigates to `/approve` (`packages/nextjs/app/approve/page.tsx`)

**Step-by-Step Execution:**

1. **Check Current Allowance**
   - Page loads, `useEffect` runs (line 26)
   - Calls `checkAllowance()` async function (line 27)
   - **Query**:
     ```typescript
     const currentAllowance = await publicClient.readContract({
         address: USDC,
         abi: contracts.MockUSDC.abi,
         functionName: "allowance",
         args: [userAddress, PROTOCOL_ADDRESS]
     });
     ```
   - Stores allowance in state (line 39)

2. **Display Approval Status**
   - If `allowance > 0n`: Shows "Approval Active" (line 163)
   - If `allowance === maxUint256`: Shows "Unlimited Approval Active" (line 168)
   - If `allowance === 0n`: Shows "Approval required to enable tap-to-pay" (line 180)

3. **User Approves Spending**
   - User clicks "Approve USDC Spending" button (line 213)
   - Triggers `handleApprove()` function (line 51)
   - Calls `writeContract()` via wagmi (line 61)
   - **Contract**: MockUSDC (or any ERC20 token)
   - **Function**: `approve(address spender, uint256 amount)`
   - **Arguments**: `[PROTOCOL_ADDRESS, maxUint256]`
   - **maxUint256**: Unlimited approval (2^256 - 1)

4. **Transaction Submission**
   - User confirms in wallet
   - Transaction submitted to blockchain
   - `writeContract` callbacks handle success/error (line 69)

5. **Success State**
   - `onSuccess` callback triggered (line 69)
   - Status message: "Success! You can now make tap-to-pay payments." (line 70)
   - Allowance re-checked via `isSuccess` dependency (line 49)
   - Button changes to "Configure Chip Actions" (line 231)

**Important Notes:**
- Approval is one-time setup per token per user
- User can revoke approval anytime via "Revoke Approval" button (line 84)
- Revoke calls `approve(PROTOCOL_ADDRESS, 0n)` (line 96)

**Key Files:**
- Frontend: `packages/nextjs/app/approve/page.tsx`
- Contract: ERC20 token (MockUSDC or any standard ERC20)

---

### 3. Configuration Flow

**Goal**: Set up what happens when user taps their chip

**Starting Point**: User navigates to `/configure` (`packages/nextjs/app/configure/page.tsx`)

**Step-by-Step Execution:**

1. **Fetch Registered Chips**
   - Page uses `useReadContract()` hook (line 57)
   - **Query**:
     ```typescript
     {
         address: registryAddress,
         abi: registryAbi,
         functionName: "getOwnerChips",
         args: [userAddress]
     }
     ```
   - **Contract**: TapThatXRegistry.getOwnerChips() (line 55)
   - Returns array of chip addresses
   - Displays chips in dropdown (line 247)

2. **Auto-Select First Chip**
   - `useEffect` runs when chips loaded (line 98)
   - Automatically selects first chip if available (line 100)

3. **Fetch Existing Configuration**
   - `useReadContract()` hook watches selectedChip (line 70)
   - **Query**:
     ```typescript
     {
         address: configurationAddress,
         abi: configurationAbi,
         functionName: "getConfiguration",
         args: [userAddress, selectedChipAddress]
     }
     ```
   - **Contract**: TapThatXConfiguration.getConfiguration() (line 85)
   - Returns ActionConfig struct:
     ```typescript
     {
         targetContract: "0x...",
         staticCallData: "0x...",
         description: "Send 10 USDC to Alice",
         isActive: true
     }
     ```
   - Displays existing config if present (line 261)

4. **User Configures Action**
   - User selects action type from dropdown (line 278)
   - Options: "USDC Transfer", "ERC20 Transfer", "Uniswap Swap", "Custom"
   - For ERC20 transfer, user enters:
     - **Token Address** (line 296)
     - **Recipient Address** (line 312)
     - **Amount** (line 324)
     - **Description** (optional) (line 334)

5. **Dynamic Decimals Fetching**
   - When user enters token address, `useReadContract()` triggers (line 81)
   - **Query**:
     ```typescript
     {
         address: tokenAddress,
         abi: ERC20_ABI,
         functionName: "decimals"
     }
     ```
   - **ERC20 Standard**: All ERC20 tokens have `decimals()` function
   - Returns uint8 (typically 6, 8, or 18)
   - Stored in `tokenDecimals` state (line 93)
   - Displayed to user: "✓ Token decimals: 6" (line 307)

6. **Build Call Data**
   - User clicks "Save Configuration" (line 383)
   - Triggers `handleSaveConfiguration()` (line 121)
   - **Build callData**:
     ```typescript
     const template = actionTemplates.find(t => t.id === selectedTemplate);
     const amountBigInt = formatTokenAmount(amount, tokenDecimals);
     const callDataResult = template.buildCallData({
         tokenAddress: tokenAddress,
         from: userAddress,
         to: recipientAddress,
         amount: amountBigInt
     });
     ```
   - **Template Location**: `packages/nextjs/utils/actionTemplates.ts:66`
   - **Template Function**:
     ```typescript
     buildCallData: (params) => {
         const callData = encodeFunctionData({
             abi: ERC20_ABI,
             functionName: "transferFrom",
             args: [params.from, params.to, params.amount]
         });
         return { target: params.tokenAddress, callData };
     }
     ```
   - **Result**: Encoded bytes for ERC20.transferFrom(from, to, amount)

7. **Submit Configuration to Blockchain**
   - Calls `writeContract()` via wagmi (line 177)
   - **Contract**: TapThatXConfiguration
   - **Function**: `setConfiguration(address chip, address targetContract, bytes calldata staticCallData, string calldata description)`
   - **Contract Location**: `packages/foundry/contracts/core/TapThatXConfiguration.sol:38`

8. **On-Chain Storage**
   ```solidity
   // Validate ownership (line 47)
   require(registry.hasChip(msg.sender, chip), "Not chip owner");

   // Store configuration (line 49)
   configurations[msg.sender][chip] = ActionConfig({
       targetContract: targetContract,      // USDC address
       staticCallData: staticCallData,      // Encoded transferFrom()
       description: description,            // "Send 10 USDC to Alice"
       isActive: true
   });

   // Emit event (line 56)
   emit ConfigurationSet(msg.sender, chip, targetContract, description);
   ```

9. **Success State**
   - Frontend waits for confirmation via `useWaitForTransactionReceipt()` (line 32)
   - `useEffect` detects confirmation (line 113)
   - Sets flow state to "success" (line 115)
   - Message: "Configuration saved successfully!" (line 116)
   - Refetches configuration to display updated values (line 117)

**Key Files:**
- Frontend: `packages/nextjs/app/configure/page.tsx`
- Templates: `packages/nextjs/utils/actionTemplates.ts`
- Contract: `packages/foundry/contracts/core/TapThatXConfiguration.sol`

---

### 4. Execution Flow

**Goal**: Execute pre-configured action by tapping chip

**Starting Point**: User navigates to `/execute` (`packages/nextjs/app/execute/page.tsx`)

**Step-by-Step Execution:**

1. **User Initiates Execution**
   - User clicks "Execute Tap" button (line 294)
   - Triggers `handleExecute()` function (line 42)

2. **Detect Chip**
   - Sets flow state to "detecting" (line 57)
   - Prompts user: "Hold your device near the NFC chip..." (line 58)
   - Calls `signMessage({ message: "init", format: "text" })` (line 60)
   - **Hook Location**: `packages/nextjs/hooks/useHaloChip.ts:18`
   - Returns chip address

3. **Validate Chip Ownership**
   - Calls `publicClient.readContract()` (line 64)
   - **Query**:
     ```typescript
     {
         address: REGISTRY_ADDRESS,
         abi: contracts.TapThatXRegistry.abi,
         functionName: "hasChip",
         args: [userAddress, detectedChipAddress]
     }
     ```
   - **Contract**: TapThatXRegistry.hasChip() (line 70)
   - If not owned: Error "Chip not registered to your account" (line 74)

4. **Fetch Configuration**
   - Calls `publicClient.readContract()` (line 80)
   - **Query**:
     ```typescript
     {
         address: CONFIGURATION_ADDRESS,
         abi: contracts.TapThatXConfiguration.abi,
         functionName: "getConfiguration",
         args: [userAddress, detectedChipAddress]
     }
     ```
   - **Contract**: TapThatXConfiguration.getConfiguration() (line 85)
   - Returns:
     ```typescript
     {
         targetContract: "0x...",      // USDC address
         staticCallData: "0x...",      // Encoded transferFrom()
         description: "Send 10 USDC to Alice",
         isActive: true
     }
     ```

5. **Validate Configuration**
   ```typescript
   // Check configuration exists (line 87)
   if (config.targetContract === "0x0000000000000000000000000000000000000000") {
       setFlowState("error");
       setStatusMessage("No configuration found. Please configure at /configure.");
       return;
   }

   // Check configuration is active (line 93)
   if (!config.isActive) {
       setFlowState("error");
       setStatusMessage("Configuration is inactive. Please activate at /configure.");
       return;
   }
   ```

6. **Display Action Preview**
   - Sets actionPreview state (line 99)
   - UI displays what will be executed (line 227):
     ```
     Ready to Execute
     Send 10 USDC to Alice
     Target: 0xA0b8...eB48
     ```

7. **Chip Signs Authorization**
   - Sets flow state to "authorizing" (line 104)
   - Prompts user: "Tap your chip again to authorize execution..." (line 105)
   - Generates timestamp and nonce:
     ```typescript
     const timestamp = Math.floor(Date.now() / 1000);
     const nonce = `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)))
         .map(b => b.toString(16).padStart(2, "0"))
         .join("")}`;
     ```
   - Calls `signTypedData()` (line 112)
   - **Typed Data Structure**:
     ```typescript
     {
         domain: {
             name: "TapThatXProtocol",
             version: "1",
             verifyingContract: PROTOCOL_ADDRESS
         },
         types: {
             CallAuthorization: [
                 { name: "owner", type: "address" },
                 { name: "target", type: "address" },
                 { name: "callData", type: "bytes" },
                 { name: "value", type: "uint256" },
                 { name: "timestamp", type: "uint256" },
                 { name: "nonce", type: "bytes32" }
             ]
         },
         primaryType: "CallAuthorization",
         message: {
             owner: userAddress,
             target: config.targetContract,      // USDC address
             callData: config.staticCallData,    // Encoded transferFrom()
             value: 0n,
             timestamp: BigInt(timestamp),
             nonce: nonce
         }
     }
     ```
   - Chip signs complete authorization
   - Returns EIP-712 signature

8. **Send to Gasless Relay**
   - Sets flow state to "executing" (line 143)
   - Message: "Executing action on blockchain..." (line 144)
   - Calls `relayExecuteTap()` (line 146)
   - **Hook Location**: `packages/nextjs/hooks/useGaslessRelay.ts:6`
   - **Sends POST to**: `/api/relay-execute-tap`
   - **Payload**:
     ```typescript
     {
         owner: userAddress,
         chip: detectedChipAddress,
         chipSignature: "0x...",
         timestamp: 1234567890,
         nonce: "0x...",
         chainId: 11155111
     }
     ```

9. **Relay API Processes Request**
   - **API Location**: `packages/nextjs/app/api/relay-execute-tap/route.ts`
   - **Validate inputs** (line 19)
   - **Get deployed contracts** (line 28)
   - **Setup relayer wallet**:
     ```typescript
     const account = privateKeyToAccount(RELAYER_PRIVATE_KEY);
     const rpcUrl = getAlchemyHttpUrl(chainId) || chainConfig.rpcUrls.default.http[0];
     const client = createWalletClient({
         account,
         chain: chainConfig,
         transport: http(rpcUrl)
     }).extend(publicActions);
     ```
   - **Submit transaction** (line 50):
     ```typescript
     const hash = await client.writeContract({
         address: contracts.TapThatXExecutor.address,
         abi: contracts.TapThatXExecutor.abi,
         functionName: "executeTap",
         args: [owner, chip, chipSignature, timestamp, nonce]
     });
     ```

10. **TapThatXExecutor.executeTap() Execution**
    - **Contract Location**: `packages/foundry/contracts/core/TapThatXExecutor.sol:40`
    - **Fetch configuration** (line 51):
      ```solidity
      TapThatXConfiguration.ActionConfig memory config =
          configuration.getConfiguration(owner, chip);
      ```
    - **Validate configuration** (line 53):
      ```solidity
      require(config.targetContract != address(0), "No configuration exists");
      require(config.isActive, "Configuration is inactive");
      ```
    - **Execute via protocol** (line 57):
      ```solidity
      (success, returnData) = protocol.executeAuthorizedCall(
          owner,
          config.targetContract,    // USDC address
          config.staticCallData,    // Encoded transferFrom()
          0,                        // No ETH value
          chipSignature,
          timestamp,
          nonce
      );
      ```

11. **TapThatXProtocol.executeAuthorizedCall() Validation**
    - **Contract Location**: `packages/foundry/contracts/core/TapThatXProtocol.sol:45`
    - **Check nonce not used** (line 59):
      ```solidity
      require(!usedNonces[nonce], "Nonce already used");
      ```
    - **Verify chip authorization** (line 62):
      ```solidity
      address chip = _verifyChipAuth(
          owner,
          target,
          callData,
          value,
          timestamp,
          nonce,
          chipSignature
      );
      ```
    - **Inside _verifyChipAuth()** (line 103):
      ```solidity
      // 1. Validate timestamp (line 124)
      require(
          TapThatXAuth.validateTimestamp(timestamp, MAX_TIMESTAMP_WINDOW),
          "Authorization expired"
      );

      // 2. Recover chip address from signature (line 128)
      address chip = TapThatXAuth.recoverChipFromCallAuth(
          _chainAgnosticDomainSeparator(),
          auth,
          signature
      );
      ```
    - **TapThatXAuth.recoverChipFromCallAuth()** (line 57):
      ```solidity
      // Build EIP-712 hash
      bytes32 structHash = keccak256(abi.encode(
          CALL_AUTH_TYPEHASH,
          auth.owner,
          auth.target,
          keccak256(auth.callData),
          auth.value,
          auth.timestamp,
          auth.nonce
      ));
      bytes32 digest = keccak256(abi.encodePacked(
          "\x19\x01",
          domainSeparator,
          structHash
      ));

      // Recover signer
      return digest.recover(signature);
      ```
    - **Validate chip ownership** (line 65):
      ```solidity
      require(registry.hasChip(owner, chip), "Owner does not have chip");
      ```
    - **Mark nonce as used** (line 68):
      ```solidity
      usedNonces[nonce] = true;
      emit NonceUsed(nonce);
      ```

12. **Execute Target Contract Call**
    - **Execute the call** (line 72):
      ```solidity
      (success, returnData) = target.call{ value: value }(callData);
      ```
    - **For ERC20 transfer**, this executes:
      ```solidity
      // On USDC contract:
      function transferFrom(address from, address to, uint256 amount) {
          // Transfer tokens from owner to recipient
          // Protocol was pre-approved to spend owner's tokens
      }
      ```
    - **Emit event** (line 74):
      ```solidity
      emit AuthorizedCallExecuted(
          owner,
          chip,
          target,
          callData,
          value,
          nonce,
          success
      );
      ```

13. **Return to Frontend**
    - Relay API waits for transaction receipt (line 64)
    - Returns to frontend:
      ```json
      {
          "success": true,
          "transactionHash": "0x...",
          "blockNumber": "12345"
      }
      ```
    - Frontend sets flow state to "success" (line 157)
    - Message: "Success! Action executed: Send 10 USDC to Alice" (line 158)

**Key Files:**
- Frontend: `packages/nextjs/app/execute/page.tsx`
- Hook: `packages/nextjs/hooks/useHaloChip.ts`
- Hook: `packages/nextjs/hooks/useGaslessRelay.ts`
- API: `packages/nextjs/app/api/relay-execute-tap/route.ts`
- Contract: `packages/foundry/contracts/core/TapThatXExecutor.sol`
- Contract: `packages/foundry/contracts/core/TapThatXProtocol.sol`
- Library: `packages/foundry/contracts/core/TapThatXAuth.sol`
- Registry: `packages/foundry/contracts/core/TapThatXRegistry.sol`

---

## Key Technical Concepts

### EIP-712 Typed Signatures
- **Purpose**: Structured data signing standard
- **Benefit**: Users see what they're signing (better UX than raw signatures)
- **Chain-Agnostic**: Domain separator excludes chainId for cross-chain chip reuse
- **Implementation**: Used for both registration and execution authorization

### HaLo NFC Chips
- **Manufacturer**: Arx Research
- **Technology**: NFC chips with embedded secure private keys
- **Key Feature**: Private key never leaves chip (secure element)
- **Library**: @arx-research/libhalo for Web NFC API integration
- **Commands**:
  - `sign` with message: General signing
  - `sign` with typedData: EIP-712 signing

### Gasless Transactions (Meta-Transactions)
- **Problem**: Users need native tokens (ETH) to pay gas fees
- **Solution**: Backend relayer pays gas on behalf of user
- **Security**: Chip signature proves user authorized the action
- **Implementation**:
  - Frontend sends signed authorization to relay API
  - Relay API submits transaction using relayer's private key
  - Smart contract validates chip signature before execution

### Pre-Configured Actions
- **Benefit**: User configures once, executes many times
- **Storage**: On-chain in TapThatXConfiguration
- **Structure**: (owner, chip) → ActionConfig
- **Flexibility**: Can configure different actions for different chips

### Replay Protection
- **Nonce-Based**: Each signature uses unique random nonce
- **Storage**: `mapping(bytes32 => bool) public usedNonces`
- **Validation**: Contract checks nonce hasn't been used before execution
- **Benefit**: Prevents reusing signatures for multiple transactions

### Timestamp Validation
- **Window**: 5 minutes (300 seconds)
- **Purpose**: Prevent stale signatures from being executed
- **Implementation**:
  ```solidity
  require(timestamp <= block.timestamp, "Future timestamp");
  require(block.timestamp - timestamp <= MAX_TIMESTAMP_WINDOW, "Expired");
  ```

### Universal Token Support
- **Dynamic Decimals**: Fetches decimals from token contract at configuration time
- **No Hardcoding**: Works with USDC (6), DAI (18), WBTC (8), any ERC20
- **Implementation**: Queries `ERC20.decimals()` function
- **UI Feedback**: Displays detected decimals to user

---

## Deployment Information

### Networks
- **Sepolia Testnet**: Chain ID 11155111
- **Base Sepolia Testnet**: Chain ID 84532

### Contract Addresses
Located in: `packages/nextjs/contracts/deployedContracts.ts`

Structure:
```typescript
{
  [chainId]: {
    TapThatXRegistry: { address: "0x...", abi: [...] },
    TapThatXProtocol: { address: "0x...", abi: [...] },
    TapThatXConfiguration: { address: "0x...", abi: [...] },
    TapThatXExecutor: { address: "0x...", abi: [...] },
    MockUSDC: { address: "0x...", abi: [...] }
  }
}
```

### Environment Variables
- `RELAYER_PRIVATE_KEY`: Private key for gasless relay (backend only)
- `ALCHEMY_API_KEY`: RPC provider API key (automatically used by scaffold-eth)

### Deployment Script
Located in: `packages/foundry/script/Deploy.s.sol`

Deployment order:
1. MockUSDC (test token)
2. TapThatXRegistry
3. TapThatXProtocol (requires TapThatXRegistry address)
4. TapThatXConfiguration (requires TapThatXRegistry address)
5. TapThatXExecutor (requires TapThatXProtocol and TapThatXConfiguration addresses)

---

## Navigation Flow

Users follow this progression:

1. **Home (/)** → Introduction and overview
2. **Register (/register)** → Link NFC chip to wallet
3. **Approve (/approve)** → Pre-approve token spending
4. **Configure (/configure)** → Set up chip action
5. **Execute (/execute)** → Tap chip to execute action

### Navigation Components

- **UnifiedNavigation**: Bottom navigation bar with icons
  - Location: `packages/nextjs/components/UnifiedNavigation.tsx`
  - Icons: Home, Nfc, Shield, Settings, Zap

- **NavigationArrows**: Previous/Next step arrows
  - Location: `packages/nextjs/components/NavigationArrows.tsx`

- **NavigationDots**: Step indicator dots
  - Location: `packages/nextjs/components/NavigationDots.tsx`

- **Header**: Top header with wallet connection
  - Location: `packages/nextjs/components/Header.tsx`
  - RainbowKit integration for wallet connect

---

## Security Features

### Smart Contract Level
1. **ReentrancyGuard**: Prevents reentrancy attacks on TapThatXProtocol and TapThatXExecutor
2. **Nonce Tracking**: Prevents signature replay attacks
3. **Timestamp Validation**: 5 minute window prevents stale signatures
4. **Ownership Validation**: All actions verify chip ownership via TapThatXRegistry
5. **EIP-712 Signatures**: Structured data signing for better security and UX

### Frontend Level
1. **Wallet Connection**: Required for all operations
2. **Network Detection**: Validates contracts deployed on current chain
3. **Input Validation**: Validates addresses, amounts before submission
4. **Error Handling**: Graceful error messages for all failure modes

### Relay Level
1. **Signature Validation**: Smart contract validates chip signature (relay can't forge)
2. **Rate Limiting**: Can be added to prevent abuse
3. **Environment Variables**: Sensitive keys stored securely

---

## Testing

Test suite located in: `packages/foundry/test/TapThatX.t.sol`

Coverage:
- ✅ Chip registration
- ✅ Configuration management
- ✅ Execution validation
- ✅ Signature verification
- ✅ Nonce replay protection
- ✅ Timestamp validation
- ✅ Ownership verification

Run tests:
```bash
cd packages/foundry
forge test -vvv
```

---

## Future Enhancements

### Planned Features
1. **Uniswap Integration**: Tap-to-swap tokens
2. **NFT Transfers**: Tap-to-send NFTs
3. **Multi-Action Support**: Execute multiple actions in single tap
4. **Spending Limits**: Daily/weekly limits per chip
5. **Emergency Pause**: Owner can pause all chip executions
6. **Delegation**: Allow others to use your configured chips

### Advanced Features
1. **Conditional Execution**: Time-based or price-based triggers
2. **Recurring Payments**: Subscription-like payments via tap
3. **Cross-Chain Execution**: Execute on different chain than chip registration
4. **DeFi Strategies**: Tap to enter/exit liquidity pools, yield farms

---

## Development Notes

### Adding New Action Templates

1. **Create template in** `packages/nextjs/utils/actionTemplates.ts`:
   ```typescript
   export const myTemplate: ActionTemplate = {
       id: "my-action",
       name: "My Action",
       description: "What it does",
       category: "defi",
       buildCallData: (params) => {
           const callData = encodeFunctionData({
               abi: MY_CONTRACT_ABI,
               functionName: "myFunction",
               args: [params.arg1, params.arg2]
           });
           return { target: params.targetAddress, callData };
       }
   };
   ```

2. **Add to actionTemplates array** (line 153)

3. **Add UI in** `packages/nextjs/app/configure/page.tsx`:
   - Add template-specific form fields
   - Handle in `handleSaveConfiguration()` switch statement

### Deploying to New Network

1. **Update** `packages/foundry/script/Deploy.s.sol` if needed
2. **Run deployment**:
   ```bash
   cd packages/foundry
   forge script script/Deploy.s.sol --rpc-url <RPC_URL> --broadcast --verify
   ```
3. **Update** `packages/nextjs/contracts/deployedContracts.ts` with new addresses
4. **Update** `packages/nextjs/utils/scaffold-eth/networks.ts` if custom network

### Debugging Tips

1. **Check browser console**: NFC errors, signature issues
2. **Check relay logs**: Backend execution errors
3. **Check block explorer**: On-chain transaction status
4. **Verify signatures**: Use contract view functions to test signature recovery
5. **Test with mock**: Use MockUSDC for testing before production tokens

---

## Common Issues & Solutions

### "Chip not registered to this owner"
- **Cause**: Chip not linked to wallet
- **Solution**: Go to /register and register chip first

### "No configuration found for this chip"
- **Cause**: No action configured for chip
- **Solution**: Go to /configure and set up action

### "Insufficient allowance"
- **Cause**: Token not approved for protocol spending
- **Solution**: Go to /approve and approve token spending

### "Authorization expired"
- **Cause**: Signature timestamp > 5 minutes old
- **Solution**: Try again with fresh tap

### "Nonce already used"
- **Cause**: Signature was already executed
- **Solution**: Generate new signature by tapping again

### "Invalid chip signature"
- **Cause**: Wrong chip tapped or signature corrupted
- **Solution**: Ensure correct chip is tapped, try again

---

## Contact & Resources

- **HaLo Chip Documentation**: https://docs.arx.org/
- **EIP-712 Specification**: https://eips.ethereum.org/EIPS/eip-712
- **Scaffold-ETH 2**: https://scaffoldeth.io/

---

*Last Updated: 2025-10-23*
*Version: 1.0.0*
