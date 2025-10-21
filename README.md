# Tap That X

> Tap your phone to authorize any blockchain transaction—no wallet popups

Tap That X eliminates wallet popup friction for blockchain transactions using NFC chips. Users register their chip once, pre-approve spending limits, then tap their phone to authorize any on-chain action—payments, DeFi interactions, contract calls—without MetaMask interruptions.

**Built for ETHOnline 2025 Hackathon**

## 🎯 The Problem

Current blockchain UX requires users to:

- Approve every transaction in MetaMask/wallet
- Switch networks manually
- Sign multiple times for a single action
- Wait through multiple confirmation screens

This creates friction that prevents mainstream adoption.

## 💡 The Solution

**Physical tap authorization** replaces wallet popups:

1. **One-time setup:** Register NFC chip + approve spending limits
2. **Every payment:** Tap phone → chip signs authorization → transaction executes
3. **Result:** Sub-3-second payments with zero wallet popups

## 🏗 Architecture

```
┌─────────────┐
│  NFC Chip   │ ──── Signs EIP-712 messages with private key
└──────┬──────┘
       │ tap
┌──────▼──────────┐
│  Mobile Device  │ ──── Reads chip via @arx-research/libhalo
└──────┬──────────┘
       │ HTTP
┌──────▼──────────┐
│  Relay Server   │ ──── Sponsors gas, submits transaction
└──────┬──────────┘
       │ on-chain
┌──────▼────────────────┐
│  TapThatXProtocol     │ ──── Verifies chip signature, executes call
│  TapThatXRegistry     │ ──── Validates chip ownership
└───────────────────────┘
```

## 📜 Smart Contracts

Deployed on **Base Sepolia** (Chain ID: 84532)

### Core Contracts

#### [TapThatXRegistry](packages/foundry/contracts/core/TapThatXRegistry.sol)

**Address:** `0x91D05d5B8913BCdA59f1923dC6831B108154Df22`

Manages chip registration and ownership via EIP-712 signatures.

**Key Functions:**

- `registerChip(address chipAddress, bytes chipSignature)` - Register chip with ownership proof
- `getOwner(address chip)` - Get chip owner
- `isChipRegistered(address chip)` - Check registration status

**EIP-712 Domain:**

```solidity
name: "TapThatXRegistry"
version: "1"
```

#### [TapThatXProtocol](packages/foundry/contracts/core/TapThatXProtocol.sol)

**Address:** `0x0F917750db157D65c6c14e5Ce5828a250569afE1`

Executes arbitrary contract calls authorized by registered chips.

**Key Functions:**

- `executeAuthorizedCall(address owner, address target, bytes callData, uint256 value, bytes chipSignature, uint256 timestamp, bytes32 nonce)` - Execute chip-authorized transaction
- `verifyChipAuth(...)` - Verify chip authorization signature

**Security Features:**

- ✅ Nonce-based replay protection
- ✅ 5-minute timestamp window
- ✅ Chip ownership validation via Registry
- ✅ ReentrancyGuard protection

**EIP-712 CallAuthorization:**

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

#### [TapThatXAuth](packages/foundry/contracts/core/TapThatXAuth.sol)

Authentication library providing signature verification utilities.

**Functions:**

- `validateTimestamp(uint256 timestamp, uint256 maxWindow)` - Validate timestamp freshness
- `recoverChipFromCallAuth(bytes32 domainSeparator, CallAuthorization auth, bytes signature)` - Recover chip address from signature

#### [USDCTapPayment](packages/foundry/contracts/examples/USDCTapPayment.sol)

**Address:** `0x4C39e327108808f0121c37110B8970752E2fC5de`

Example implementation showing tap-to-pay for USDC tokens.

**Key Functions:**

- `tapToPay(address owner, bytes transferCallData, bytes chipSignature, uint256 timestamp, bytes32 nonce)` - Execute USDC payment via chip authorization
- `checkAllowance(address owner, uint256 amount)` - Check if user has approved sufficient USDC
- `getApprovalTarget()` - Returns TapThatXProtocol address for approval

#### [MockUSDC](packages/foundry/contracts/MockUSDC.sol)

**Address:** `0x419184067e0C40D3622717be5dF4758DFd3d7242`

Test USDC token with 6 decimals (ERC20).

## 🎨 Frontend Implementation

Built with Next.js 15 and React 19.

### Pages

#### [Landing Page](packages/nextjs/app/page.tsx) - `/`

- Project introduction
- "Register Your Chip" CTA
- Glassmorphism design with mobile-first UX

#### [Chip Registration](packages/nextjs/app/register/page.tsx) - `/register`

**3-Step Flow:**

1. **Detect Chip** - Hold device near NFC chip (2-3 sec)
2. **Sign Authorization** - Tap chip to authorize registration (2-3 sec)
3. **Confirm Transaction** - Confirm in wallet (5-10 sec)

**Features:**

- Real-time step indicators
- ChipAddressDisplay component showing registered address
- Success state with "Register Another Chip" option

**Implementation:**

```typescript
// Step 1: Read chip address
const chipData = await signMessage({ message: "init", format: "text" });
const chipAddress = chipData.address;

// Step 2: Sign EIP-712 registration
const registrationSig = await signTypedData({
  domain: { name: "TapThatXRegistry", version: "1", chainId, verifyingContract },
  types: { ChipRegistration: [...] },
  message: { owner: userAddress, chipAddress }
});

// Step 3: Submit transaction
writeContract({
  address: registryAddress,
  abi: registryAbi,
  functionName: "registerChip",
  args: [chipAddress, registrationSig.signature]
});
```

#### [USDC Approval](packages/nextjs/app/approve/page.tsx) - `/approve`

One-time USDC approval setup for seamless payments.

**Features:**

- Current allowance checker
- Approve unlimited spending (maxUint256)
- Revoke approval option
- Real-time approval status with success indicators

**Implementation:**

```typescript
// Approve USDC spending to TapThatXProtocol
writeContract({
  address: USDC_ADDRESS,
  abi: usdcAbi,
  functionName: "approve",
  args: [PROTOCOL_ADDRESS, maxUint256],
});
```

#### [Tap to Pay](packages/nextjs/app/payment/page.tsx) - `/payment`

**3-Step Payment Flow:**

1. **Detect & Verify** - Verify chip ownership (2-3 sec)
2. **Authorize Payment** - Tap chip to authorize (2-3 sec)
3. **Process Transaction** - Relay to blockchain (10-15 sec)

**Features:**

- Automatic chip ownership verification via Registry
- Balance preview showing pre/post-transaction state
- Gasless execution (relayer pays gas)
- "No wallet popup needed" badge

**Implementation:**

```typescript
// Step 1: Detect chip and verify registration
const chipData = await signMessage({ message: "init", format: "text" });
const chipAddress = chipData.address;
const chipOwner = await registry.getOwner(chipAddress);

// Step 2: Build USDC transfer calldata
const transferCallData = encodeTransferFrom(userAddress, merchant, amount);

// Step 3: Chip signs EIP-712 authorization
const chipSig = await signTypedData({
  domain: { name: "TapThatXProtocol", version: "1", chainId, verifyingContract },
  types: { CallAuthorization: [...] },
  message: { owner, target: USDC, callData: transferCallData, value: 0, timestamp, nonce }
});

// Step 4: Relay payment (gasless)
await relayPayment({ owner, transferCallData, chipSignature, timestamp, nonce });
```

### Custom Hooks

#### [useHaloChip](packages/nextjs/hooks/useHaloChip.ts)

NFC chip communication via @arx-research/libhalo.

**Functions:**

- `signMessage({ message, digest, format })` - Sign arbitrary message
- `signTypedData({ domain, types, primaryType, message })` - Sign EIP-712 structured data

**Features:**

- BigInt serialization for JSON compatibility
- Error handling with user-friendly messages
- Loading state management

#### [useGaslessRelay](packages/nextjs/hooks/useGaslessRelay.ts)

Backend relayer for gasless transactions.

**Function:**

- `relayPayment(paymentData)` - Submit payment to relay API

**Implementation:**

```typescript
const relayPayment = async (paymentData) => {
  const response = await fetch("/api/relay-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...paymentData, chainId }),
  });
  return await response.json();
};
```

### Backend API

#### [Relay Payment API](packages/nextjs/app/api/relay-payment/route.ts)

Next.js API route that sponsors gas for user transactions.

**Endpoint:** `POST /api/relay-payment`

**Request Body:**

```typescript
{
  owner: address,           // User address
  transferCallData: bytes,  // Encoded USDC transfer
  chipSignature: bytes,     // Chip's EIP-712 signature
  timestamp: uint256,       // Authorization timestamp
  nonce: bytes32,          // Unique nonce
  chainId: number          // Chain ID
}
```

**Response:**

```typescript
{
  success: true,
  transactionHash: string,
  blockNumber: string
}
```

**Implementation:**

```typescript
// Relayer signs transaction with private key
const account = privateKeyToAccount(RELAYER_PRIVATE_KEY);
const client = createWalletClient({ account, chain, transport: http(rpcUrl) });

// Call USDCTapPayment.tapToPay
const hash = await client.writeContract({
  address: usdcPaymentAddress,
  abi: usdcPaymentAbi,
  functionName: "tapToPay",
  args: [owner, transferCallData, chipSignature, timestamp, nonce],
});

const receipt = await client.waitForTransactionReceipt({ hash });
```

**Environment Variables:**

- `RELAYER_PRIVATE_KEY` - Private key of relayer account (must be funded)
- `ALCHEMY_API_KEY` - Alchemy RPC endpoint (optional, falls back to public RPC)

### UI Components

**Design System:**

- Glassmorphism cards with blur effects
- Mobile-first responsive design (thumb zone optimization)
- Lucide React icons
- Step indicators for multi-step flows
- Real-time status messages with animations

**Key Components:**

- `StepIndicator` - Progress visualization for flows
- `ChipAddressDisplay` - Show registered chip address
- `BalancePreview` - Pre/post transaction balance preview
- `UnifiedNavigation` - Bottom navigation bar

## 🧪 Testing

Comprehensive test suite in [TapThatX.t.sol](packages/foundry/test/TapThatX.t.sol)

**Test Coverage:**

✅ **Chip Registration**

- `testRegisterChip()` - Successfully register chip with valid signature
- `testCanReregisterChip()` - Allow chip re-registration (hackathon flexibility)

✅ **Authorized Calls**

- `testExecuteAuthorizedCall()` - Execute USDC transfer via chip authorization
- `testUnregisteredChipRejected()` - Reject calls from unregistered chips

✅ **Security**

- `testCannotReplayNonce()` - Nonce replay protection
- `testExpiredTimestamp()` - Reject expired authorizations (>5 min old)

✅ **Example Implementation**

- `testUSDCTapPayment()` - End-to-end USDC payment flow

**Run Tests:**

```bash
yarn foundry:test
```

## 🛠 Technology Stack

### Smart Contracts

- **Foundry** - Solidity development framework
- **OpenZeppelin** - EIP712, ECDSA, ReentrancyGuard, Ownable
- **Solidity ^0.8.19**

### Frontend

- **Next.js 15** - React framework with App Router
- **React 19** - UI library
- **Wagmi 2.16** - React hooks for Ethereum
- **Viem 2.34** - TypeScript Ethereum library
- **RainbowKit 2.2** - Wallet connection UI
- **@arx-research/libhalo 1.15** - NFC chip communication

### UI/UX

- **TailwindCSS 4** - Utility-first CSS
- **DaisyUI 5** - Component library
- **Lucide React** - Icon library
- **GSAP 3.13** - Animation library (optional)
- **Glassmorphism design** - Modern UI aesthetic

### Infrastructure

- **Railway** - Deployment platform
- **Alchemy** - RPC provider (optional)
- **Base Sepolia** - Testnet deployment

## 🚀 Getting Started

### Requirements

- Node.js >= 22.14.0
- npm or yarn
- MetaMask or compatible Web3 wallet
- NFC-capable mobile device with Arx HaLo chip

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/tap-that-x.git
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

**Fund Relayer Account:**

1. Generate new wallet or use existing private key
2. Get testnet ETH from [Base Sepolia Faucet](https://www.alchemy.com/faucets/base-sepolia)
3. Add private key to `.env`

### Run Locally

```bash
# Start Next.js development server
npm run start

# Visit http://localhost:3000
```

### Deploy Contracts

```bash
# Start local Foundry chain (optional for local testing)
npm run chain

# Deploy contracts to Base Sepolia
npm run deploy

# Deploy to other networks (update foundry.toml)
npm run deploy -- --network <network-name>
```

## 📊 Current Status

### ✅ What Works

**End-to-End Tap-to-Pay on Base Sepolia:**

1. ✅ Register NFC chip on-chain
2. ✅ Approve USDC spending to protocol
3. ✅ Tap phone to authorize payment
4. ✅ Gasless execution via backend relayer
5. ✅ Transaction completes in 10-15 seconds
6. ✅ Zero wallet popups during payment

**Smart Contract Features:**

- ✅ EIP-712 signature verification
- ✅ Replay attack protection (nonce system)
- ✅ Timestamp expiration (5-minute window)
- ✅ Generic `executeAuthorizedCall` for any contract
- ✅ Chip ownership registry
- ✅ ReentrancyGuard protection

**Frontend Features:**

- ✅ Mobile-first responsive design
- ✅ NFC chip communication via @arx-research/libhalo
- ✅ 3-step registration flow with visual feedback
- ✅ 3-step payment flow with status indicators
- ✅ Real-time balance preview
- ✅ Glassmorphism UI with accessibility (WCAG AA compliant)
- ✅ Bottom navigation for thumb-zone optimization

**Testing:**

- ✅ 6 comprehensive Foundry tests
- ✅ Coverage for registration, payments, security

### 🔮 What's Next

**Avail Nexus Integration:**

Transform Tap That X into a truly **cross-chain** payment protocol using Avail Nexus.

#### Vision

User holds USDC on Arbitrum, merchant accepts on Base. User taps once → Nexus routes payment across chains → settlement in seconds. Zero bridging UX.

#### Technical Implementation

**Phase 1: Multi-Chain Balance Aggregation**

- Integrate Nexus SDK for cross-chain balance queries
- Update UI to show aggregated USDC across all Nexus-connected chains
- Display available liquidity per chain

**Phase 2: Cross-Chain Authorization Schema**

- Extend EIP-712 `CallAuthorization` to include source/destination chain IDs
- Update chip signing flow to specify cross-chain routing
- Implement Nexus message passing in `TapThatXProtocol`

**Phase 3: "Deploy Once, Scale Everywhere"**

- Deploy `TapThatXProtocol` on Avail/Nexus base layer
- Enable merchants on ANY Nexus-connected chain to accept payments
- Eliminate per-chain deployment overhead

**Phase 4: UX Enhancements**

- Automatic best-route selection (lowest fees, fastest settlement)
- Unified transaction status across chains
- Sub-2-second cross-chain settlements

#### Developer Benefits

- **Before Nexus:** Deploy contracts on 10 chains = 10 deployments, fragmented liquidity
- **With Nexus:** Deploy once, access liquidity from all chains, seamless UX

#### User Benefits

- **Before Nexus:** Bridge USDC manually, switch networks, wait 10+ minutes
- **With Nexus:** Tap once, pay from any chain, settle in seconds

**Tap once. Pay anywhere. Zero friction.**
