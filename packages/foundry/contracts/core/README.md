# Tap That X Protocol

> A minimal, hackathon-ready protocol for chip-authorized blockchain interactions

## Overview

Tap That X is a generalized "Tap to Pay" protocol that enables any contract interaction to be authorized via NFC chip signatures. Unlike traditional payment-only systems, this protocol can authorize ANY blockchain action - token transfers, NFT mints, function calls, etc.

## Architecture

```
┌─────────────────────┐
│ TapThatXRegistry    │  Chip registration & ownership
└─────────────────────┘
          ↓
┌─────────────────────┐
│ TapThatXProtocol    │  Generic execution engine
└─────────────────────┘
          ↓
┌─────────────────────┐
│ Your Implementation │  Custom use cases (payments, NFTs, etc.)
└─────────────────────┘
```

## Core Contracts

### TapThatXRegistry.sol
- Registers chips to owner addresses
- Uses EIP-712 signatures for ownership proof
- One chip = one owner mapping

### TapThatXAuth.sol
- Library for signature verification
- Supports generic `CallAuthorization` and legacy `PaymentAuth`
- Timestamp validation
- EIP-712 signature recovery

### TapThatXProtocol.sol
- Generic execution engine
- Executes ANY authorized contract call
- Replay protection via nonces
- 5-minute authorization window
- Supports ETH value transfers

## User Flow

1. **Register Chip**
   ```solidity
   registry.registerChip(chipAddress, chipSignature)
   ```

2. **Grant Approvals** (if needed)
   ```solidity
   token.approve(protocol, amount)
   ```

3. **Tap to Execute**
   - User taps chip
   - Chip signs authorization
   - Protocol verifies & executes

## Example: USDC Payment

See `examples/USDCTapPayment.sol` for a complete implementation showing:
- EIP-2612 permit pattern (gasless approval)
- Pre-approval pattern
- Protocol integration

## Key Features

✅ **Generic** - Execute any contract call
✅ **Secure** - EIP-712 signatures, replay protection
✅ **Simple** - ~150 lines core protocol
✅ **Extensible** - Easy to build custom implementations
✅ **Hackathon-ready** - Minimal security, maximum flexibility

## CallAuthorization Structure

```solidity
struct CallAuthorization {
    address owner;      // Chip owner
    address target;     // Contract to call
    bytes callData;     // Encoded function call
    uint256 value;      // ETH value (optional)
    uint256 timestamp;  // Authorization timestamp
    bytes32 nonce;      // Replay protection
}
```

## Security Considerations

⚠️ **Hackathon Security** - This is a minimal implementation focused on demonstration:
- 5-minute authorization window (configurable)
- Simple nonce-based replay protection
- No emergency pause mechanism
- No upgradability

For production use, add:
- Role-based access control
- Emergency pause/unpause
- Upgradeable proxy pattern
- Rate limiting
- Multi-sig governance

## Testing

```bash
forge test --match-path "test/TapThatX.t.sol"
```

## Deployment

```bash
forge script script/Deploy.s.sol --broadcast
```

## Use Cases

- **Payments**: USDC, USDT, any ERC20
- **NFTs**: Mint, transfer, burn
- **DeFi**: Swap, stake, lend
- **Gaming**: Buy items, claim rewards
- **Identity**: Sign messages, verify ownership
- **DAO**: Vote, delegate
- **Any contract call**: Unlimited possibilities

## License

MIT
