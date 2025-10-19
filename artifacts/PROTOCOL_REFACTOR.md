# Tap That X Protocol Refactor

## What Changed

### Before (USDC-specific contracts)
```
ChipRegistry.sol          → Chip registration
ChipAuthVerifier.sol      → Payment auth verification
USDCPaymentProcessor.sol  → USDC-only payments
```

### After (Generalized protocol)
```
core/
  TapThatXRegistry.sol    → Chip registration (rebranded)
  TapThatXAuth.sol        → Generic + payment auth
  TapThatXProtocol.sol    → Execute ANY contract call

examples/
  USDCTapPayment.sol      → Demo USDC implementation
```

## Key Improvements

### 1. Generic Execution
**Before**: Could only execute USDC transfers
**After**: Can execute ANY contract call

```solidity
// Execute ANY function on ANY contract
protocol.executeAuthorizedCall(
    owner,
    targetContract,  // Any address
    callData,        // Any function call
    value,          // Optional ETH
    chipSignature,
    timestamp,
    nonce
);
```

### 2. Clean Architecture
- **Core protocol** handles chip auth & execution
- **Implementations** show specific use cases
- **Examples** demonstrate patterns

### 3. CallAuthorization Structure
New generic authorization format:

```solidity
struct CallAuthorization {
    address owner;      // Who owns the chip
    address target;     // What contract to call
    bytes callData;     // What function to execute
    uint256 value;      // How much ETH to send
    uint256 timestamp;  // When authorized
    bytes32 nonce;      // Replay protection
}
```

## Migration Guide

### For USDC Payments (existing functionality)

#### Old Way
```solidity
USDCPaymentProcessor processor;
processor.executePayment(owner, recipient, amount, chipSig, timestamp, nonce);
```

#### New Way (Option 1: Use example contract)
```solidity
USDCTapPayment payment;
payment.tapToPayWithAllowance(owner, recipient, amount, chipSig, timestamp, nonce);
```

#### New Way (Option 2: Use protocol directly)
```solidity
bytes memory callData = abi.encodeWithSelector(
    IERC20.transferFrom.selector,
    owner,
    recipient,
    amount
);

protocol.executeAuthorizedCall(
    owner,
    address(usdc),
    callData,
    0,
    chipSignature,
    timestamp,
    nonce
);
```

### For New Use Cases

#### NFT Mint
```solidity
bytes memory mintCallData = abi.encodeWithSelector(
    NFTContract.mint.selector,
    recipient,
    tokenId
);

protocol.executeAuthorizedCall(
    owner,
    address(nftContract),
    mintCallData,
    0,
    chipSignature,
    timestamp,
    nonce
);
```

#### DEX Swap
```solidity
bytes memory swapCallData = abi.encodeWithSelector(
    Router.swapExactTokensForTokens.selector,
    amountIn,
    amountOutMin,
    path,
    to,
    deadline
);

protocol.executeAuthorizedCall(
    owner,
    address(router),
    swapCallData,
    0,
    chipSignature,
    timestamp,
    nonce
);
```

#### Custom Contract Call
```solidity
bytes memory customCallData = abi.encodeWithSignature(
    "yourFunction(address,uint256,bool)",
    param1,
    param2,
    param3
);

protocol.executeAuthorizedCall(
    owner,
    address(yourContract),
    customCallData,
    0,
    chipSignature,
    timestamp,
    nonce
);
```

## File Structure Changes

### Old Structure
```
contracts/
├── ChipRegistry.sol
├── ChipAuthVerifier.sol
├── USDCPaymentProcessor.sol
└── MockUSDC.sol
```

### New Structure
```
contracts/
├── core/
│   ├── TapThatXRegistry.sol
│   ├── TapThatXAuth.sol
│   ├── TapThatXProtocol.sol
│   └── README.md
├── examples/
│   └── USDCTapPayment.sol
└── mocks/
    └── MockUSDC.sol
```

## Deployment

### Deploy All Contracts
```bash
forge script script/Deploy.s.sol --broadcast
```

### Contracts Deployed (in order)
1. TapThatXRegistry
2. TapThatXProtocol (requires registry address)
3. MockUSDC (for testing)
4. USDCTapPayment (requires USDC, protocol, registry)

## Testing

### Run Protocol Tests
```bash
forge test --match-path "test/TapThatX.t.sol" -vv
```

### Test Coverage
✅ Chip registration
✅ Generic execution
✅ Replay protection
✅ Timestamp expiry
✅ Ownership verification
✅ USDC payment example
✅ Unregistered chip rejection

## EIP-712 Signatures

### Chip Registration (unchanged)
```javascript
const domain = {
  name: "TapThatXRegistry",
  version: "1",
  chainId: chainId,
  verifyingContract: registryAddress
};

const types = {
  ChipRegistration: [
    { name: "owner", type: "address" },
    { name: "chipAddress", type: "address" }
  ]
};

const value = {
  owner: ownerAddress,
  chipAddress: chipAddress
};

const signature = await chip.signTypedData(domain, types, value);
```

### Call Authorization (new)
```javascript
const domain = {
  name: "TapThatXProtocol",
  version: "1",
  chainId: chainId,
  verifyingContract: protocolAddress
};

const types = {
  CallAuthorization: [
    { name: "owner", type: "address" },
    { name: "target", type: "address" },
    { name: "callData", type: "bytes" },
    { name: "value", type: "uint256" },
    { name: "timestamp", type: "uint256" },
    { name: "nonce", type: "bytes32" }
  ]
};

const value = {
  owner: ownerAddress,
  target: targetContract,
  callData: encodedCallData,
  value: ethValue,
  timestamp: Math.floor(Date.now() / 1000),
  nonce: generateNonce()
};

const signature = await chip.signTypedData(domain, types, value);
```

## Benefits

### For Hackathon Demo
- ✅ More impressive (generic vs specific)
- ✅ Cleaner architecture
- ✅ Easy to extend with new features
- ✅ Shows protocol thinking
- ✅ USDC payment still works

### For Production
- ✅ Extensible to any use case
- ✅ Modular design
- ✅ Clear separation of concerns
- ✅ Easy to audit
- ✅ Reusable components

## Next Steps

### For Demo
1. Build frontend that uses TapThatXProtocol
2. Show USDC payment (existing demo)
3. Add another use case (NFT mint, token swap, etc.)
4. Highlight generic execution capability

### For Production
1. Add access control
2. Add emergency pause
3. Add upgradability
4. Add rate limiting
5. Comprehensive audit
6. Gas optimization

## Questions?

Check the protocol documentation in `contracts/core/README.md`
