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
- `registerChip(address chipAddress, bytes memory chipSignature)` - Validates EIP-712 signature from chip, stores bidirectional mapping (owner↔chips)
- `getOwnerChips(address owner)` - Returns array of chips owned by address
- `getChipOwners(address chip)` - Returns array of owners for a chip
- `hasChip(address owner, address chip)` - Validates ownership

**Security:** EIP-712 signatures, chain-agnostic domain separator for cross-chain reuse, ReentrancyGuard

---

### TapThatXProtocol.sol
**Purpose**: Core execution engine for chip-authorized contract calls

**Key Functions:**
- `executeAuthorizedCall()` - Validates chip signature, checks ownership, validates nonce (replay protection), executes `target.call{value}(callData)`

**Validation Flow:**
1. Recover chip address from EIP-712 signature
2. Validate timestamp (5 minute window)
3. Check chip ownership via Registry
4. Mark nonce as used
5. Execute target contract call

**Security:** Nonce-based replay protection, timestamp validation, ReentrancyGuard, EIP-712 signatures

---

### TapThatXConfiguration.sol
**Purpose**: On-chain storage for chip-to-action mappings

**ActionConfig Struct:** targetContract, staticCallData, value (ETH amount), description, isActive
**Mapping:** owner => chip => ActionConfig

**Key Functions:**
- `setConfiguration()` - Stores action config for (owner, chip) pair, validates ownership
- `getConfiguration()` - Returns ActionConfig for owner/chip
- `isConfigured()` - Checks if active configuration exists
- `toggleConfiguration()` - Enable/disable without deleting
- `removeConfiguration()` - Deletes configuration

**Security:** Only chip owner can modify, ownership validated via Registry

---

### TapThatXExecutor.sol
**Purpose**: Simplified execution interface - fetches config and executes via Protocol

**Key Functions:**
- `executeTap()` - Fetches configuration, validates active, executes via Protocol
- `previewTap()` - View function to preview execution (used by frontend)
- `canExecute()` - Checks if tap can be executed

**Flow:** Executor → Configuration → Protocol → Auth → Registry → target.call()

**Security:** ReentrancyGuard, validation delegated to Protocol

---

### TapThatXAuth.sol
**Purpose**: Authentication library for EIP-712 signature verification

**CallAuthorization Struct:** owner, target, callData, value, timestamp, nonce

**Key Functions:**
- `validateTimestamp()` - Ensures timestamp not in future and within 5 minute window
- `recoverChipFromCallAuth()` - Constructs EIP-712 hash, recovers signer address from signature

---

## Extension Contracts

All extensions located in: `packages/foundry/contracts/extensions/`

Extensions are specialized contracts that integrate with the core TapThatXProtocol to provide advanced DeFi functionality. They handle complex operations like flash loans, DEX swaps, and cross-chain bridging.

### TapThatXPaymentTerminal.sol
**Purpose**: Point-of-sale terminal for merchant/customer tap-to-pay

**PaymentAuthorization Struct:** payer, payerChip, payee, payeeChip, token, amount, timestamp, nonce

**Key Functions:**
- `executePayment()` - Validates both chips, verifies payer signature, executes token transfer
- `verifyPaymentAuth()` - View function to verify signature validity

**Use Case:** Merchant taps to set amount → customer taps to authorize → instant payment

**Security:** Both parties need registered chips, customer signature required, 5min window, ReentrancyGuard

---

### TapThatXAaveRebalancer.sol
**Purpose**: Automated Aave V3 position rebalancing using flash loans

**RebalanceConfig Struct:** collateralAsset, debtAsset, targetHealthFactor, maxSlippage

**Key Functions:**
- `calculateOptimalFlashLoan()` - Calculates flash loan amount needed
- `executeRebalance()` - Validates position, initiates flash loan (only protocol/owner)
- `executeOperation()` - Flash loan callback: repay debt, withdraw collateral, swap via Uniswap, return excess
- `previewRebalance()` - View function for simulation
- `checkATokenApproval()` - Validates aToken approval

**Use Case:** Health factor drops → tap chip → position rebalanced → liquidation prevented

**Security:** Only protocol/owner can trigger, atomic flash loan execution, health factor validation

---

### TapThatXAavePositionCloser.sol
**Purpose**: Complete closure of Aave V3 positions using flash loans

**CloseConfig Struct:** collateralAsset, debtAsset, maxSlippage

**Key Functions:**
- `calculateFlashLoanAmount()` - Returns total debt balance
- `closePosition()` - Initiates flash loan for full debt repayment (only protocol/owner)
- `executeOperation()` - Flash loan callback: repay all debt, withdraw all collateral, swap to cover loan, return remaining assets
- `previewClose()` - View function for closure simulation
- `checkATokenApproval()` - Validates aToken approval

**Use Case:** Exit Aave position → tap chip → position fully closed → remaining assets returned

**Security:** Only protocol/owner can trigger, atomic execution, clean exit validation

---

### TapThatXBridgeETHViaWETH.sol
**Purpose**: Bridge ETH to Optimism and Base Sepolia via WETH unwrapping

**Key Functions:**
- `unwrapAndBridgeDual()` - Pulls WETH, unwraps to ETH, splits 50/50, bridges to both L2s (only protocol can call)
- `receive()` - Only accepts ETH from WETH contract

**Use Case:** WETH on L1 → tap chip → ETH on both Base and OP L2s

**Security:** Only protocol can execute, safe unwrapping, atomic bridging, recommended minGasLimit: 200,000

---

## Interface Contracts

Located in: `packages/foundry/contracts/interfaces/`

### IL1StandardBridge.sol
**Purpose**: L1→L2 ETH bridging for Optimism and Base
**Key Function:** `depositETHTo(address _to, uint32 _minGasLimit, bytes calldata _extraData)` - Bridges ETH to L2 (recommended minGasLimit: 200,000)

### IWETH.sol
**Purpose**: Wrapped ETH operations
**Key Functions:** `deposit()` - wrap ETH→WETH, `withdraw(uint256)` - unwrap WETH→ETH, standard ERC20 functions

### IUniswapV2.sol
**Purpose**: Uniswap V2 DEX operations
**Key Interfaces:**
- `IUniswapV2Router02` - `swapExactTokensForTokens()` for token swaps with slippage protection
- `IUniswapV2Factory` - `getPair()` to get pair addresses
- `IUniswapV2Pair` - `getReserves()` for price calculations

---

## Frontend Architecture

Pages: `packages/nextjs/app/` - /, /register, /approve, /configure, /execute, /payment-terminal

### Key Hooks

**useHaloChip** (`hooks/useHaloChip.ts`)
- `signMessage()` - Prompts NFC tap, returns {address, signature}, used for chip detection
- `signTypedData()` - EIP-712 signatures for registration and execution
- Uses @arx-research/libhalo library for Web NFC API

**useGaslessRelay** (`hooks/useGaslessRelay.ts`)
- `relayExecuteTap()` - Sends POST to `/api/relay-execute-tap`, returns transaction hash

### Action Templates (`utils/actionTemplates.ts`)
**Templates:** usdcTransfer, erc20Transfer, uniswapSwap, customAction
**Helpers:** `formatTokenAmount()` - string→bigint with decimals, `parseTokenAmount()` - bigint→string for display

---

## Flow Documentation

### 1. Registration Flow (`/register`)
**Goal:** Link NFC chip to wallet on-chain

**Steps:**
1. Connect wallet via RainbowKit
2. Tap chip to detect address (signMessage: "init")
3. Tap again to sign EIP-712 registration (ChipRegistration typedData)
4. Submit `registerChip(chipAddress, chipSignature)` to Registry
5. Contract validates signature, stores bidirectional mapping (owner↔chip)
6. Frontend confirms transaction and displays success

**Key Contract:** TapThatXRegistry.registerChip()

---

### 2. Approval Flow (`/approve`)
**Goal:** Pre-approve Protocol to spend tokens

**Steps:**
1. Check current allowance via `token.allowance(user, PROTOCOL_ADDRESS)`
2. Display approval status (active/unlimited/required)
3. User clicks "Approve" → calls `token.approve(PROTOCOL_ADDRESS, maxUint256)`
4. User confirms in wallet, transaction submitted
5. Success: unlimited approval active, can proceed to configuration

**Notes:** One-time setup per token. User can revoke anytime via `approve(PROTOCOL, 0)`

---

### 3. Configuration Flow (`/configure`)
**Goal:** Set what happens when chip is tapped

**Steps:**
1. Fetch registered chips via `Registry.getOwnerChips(user)`
2. Auto-select first chip, fetch existing config via `Configuration.getConfiguration(owner, chip)`
3. User selects action type (USDC/ERC20 transfer, Uniswap swap, custom)
4. For ERC20 transfer: enter token address (fetches decimals), recipient, amount, description
5. Build callData: template encodes `transferFrom(from, to, amount)` with proper decimals
6. Submit `Configuration.setConfiguration(chip, tokenAddress, callData, value, description)`
7. Contract validates ownership, stores ActionConfig (targetContract, staticCallData, value, description, isActive)
8. Success: configuration saved on-chain, ready for execution

**Key Contract:** TapThatXConfiguration.setConfiguration()

---

### 4. Execution Flow (`/execute`)
**Goal:** Execute pre-configured action by tapping chip

**Steps:**
1. Tap chip to detect address (signMessage: "init")
2. Validate ownership via `Registry.hasChip(user, chip)`
3. Fetch configuration via `Configuration.getConfiguration(owner, chip)`, validate exists and isActive
4. Display action preview to user
5. Generate timestamp & nonce, tap again to sign EIP-712 CallAuthorization (owner, target, callData, value, timestamp, nonce)
6. Send to gasless relay: POST `/api/relay-execute-tap` with {owner, chip, chipSignature, timestamp, nonce, chainId}
7. Relay validates inputs, sets up wallet with RELAYER_PRIVATE_KEY, submits `Executor.executeTap()`
8. Executor fetches config, validates, calls `Protocol.executeAuthorizedCall()`
9. Protocol validates: nonce unused, timestamp valid (5min window), chip signature via Auth.recoverChipFromCallAuth(), ownership via Registry
10. Mark nonce used, execute `target.call{value}(callData)` (e.g., token.transferFrom())
11. Emit AuthorizedCallExecuted event
12. Relay waits for receipt, returns {success, transactionHash, blockNumber}
13. Frontend displays success message

**Key Contracts:** TapThatXExecutor.executeTap() → TapThatXProtocol.executeAuthorizedCall()

---

## Key Technical Concepts

**EIP-712 Typed Signatures:** Structured signing standard, users see what they're signing, chain-agnostic domain separator for cross-chain chip reuse

**HaLo NFC Chips:** Arx Research chips with embedded secure private keys (never leave chip), @arx-research/libhalo for Web NFC API

**Gasless Transactions:** Backend relayer pays gas, chip signature proves authorization, frontend sends signed auth to relay API

**Pre-Configured Actions:** Configure once, execute many times, stored on-chain (owner, chip) → ActionConfig

**Replay Protection:** Unique nonce per signature, mapping(bytes32 => bool) usedNonces, prevents signature reuse

**Timestamp Validation:** 5 minute window (300s) prevents stale signatures

**Universal Token Support:** Dynamic decimals fetching via ERC20.decimals(), works with any token (USDC/6, DAI/18, WBTC/8)

---

## Deployment Information

**Networks:** Sepolia (11155111), Base Sepolia (84532)

**Contract Addresses:** `packages/nextjs/contracts/deployedContracts.ts` - Maps chainId → {TapThatXRegistry, Protocol, Configuration, Executor, MockUSDC, extensions...}

**Environment Variables:** `RELAYER_PRIVATE_KEY` (backend), `ALCHEMY_API_KEY` (RPC)

**Deployment Order** (`packages/foundry/script/Deploy.s.sol`):
1. Core: MockUSDC → Registry → Protocol → Configuration → Executor
2. Extensions (optional): PaymentTerminal, AaveRebalancer, AavePositionCloser, BridgeETHViaWETH

**Note:** Extensions require network-specific addresses (Aave, Uniswap, bridges)

---

## Navigation Flow

**User Progression:** / (home) → /register (link chip) → /approve (token approval) → /configure (set action) → /execute (tap to execute)

**Components:** UnifiedNavigation (bottom bar), NavigationArrows, NavigationDots (step indicators), Header (wallet connection via RainbowKit)

---

## Security Features

**Smart Contract:** ReentrancyGuard, nonce tracking (replay protection), timestamp validation (5min window), ownership validation via Registry, EIP-712 signatures

**Frontend:** Wallet connection required, network detection, input validation (addresses/amounts), graceful error handling

**Relay:** Contract validates chip signature (relay can't forge), rate limiting possible, secure env var storage

---

## Testing

**Test Suite:** `packages/foundry/test/TapThatX.t.sol`

**Coverage:** Chip registration, configuration management, execution validation, signature verification, nonce replay protection, timestamp validation, ownership verification

**Run:** `cd packages/foundry && forge test -vvv`

---

## Implemented Features

**DeFi Integration:** Aave V3 rebalancing (flash loans, prevents liquidations), Aave V3 position closure (full exit via flash loan), Uniswap V2 swaps (slippage protection, multi-hop)

**Cross-Chain:** Dual L2 ETH bridging (WETH unwrap + bridge to Base/OP, 50/50 split)

**Payment Systems:** Merchant POS terminal (dual-tap, ERC20 support, instant settlement)

---

## Future Enhancements

**Planned:** NFT transfers (ERC721/ERC1155), multi-action support, spending limits (daily/weekly), emergency pause, delegation, Uniswap V3

**Advanced:** Conditional execution (time/price triggers), recurring payments, cross-chain execution, DeFi strategies (LP management, yield farming, leveraged positions, Compound V3), lending protocols (MakerDAO, Compound, Curve), batch operations

---

## Development Notes

**Adding Action Templates:**
1. Create template in `utils/actionTemplates.ts` with buildCallData function
2. Add to actionTemplates array
3. Add UI in `/configure` page with template-specific fields

**Deploying to New Network:**
1. Update `Deploy.s.sol` if needed
2. Run: `forge script script/Deploy.s.sol --rpc-url <RPC> --broadcast --verify`
3. Update `deployedContracts.ts` with addresses
4. Update `networks.ts` if custom network

**Debugging:** Browser console (NFC/signatures), relay logs (backend errors), block explorer (tx status), contract view functions (signature recovery), MockUSDC (testing)

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

*Last Updated: 2025-11-04*
*Version: 2.0.0*

**v2.0.0 Updates:**
- Added comprehensive documentation for 4 extension contracts
- Added documentation for 3 interface contracts
- Updated ActionConfig struct to include `value` parameter
- Updated all function signatures with correct parameters
- Reorganized Future Enhancements to reflect implemented features
- Updated deployment documentation for extensions
