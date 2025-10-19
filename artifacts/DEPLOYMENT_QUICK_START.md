# Tap That X - Deployment Quick Start

## Prerequisites

1. Keystore account set up with foundry
2. Funded wallet on Base Sepolia (get from faucet)
3. Relayer private key in `.env`

## Deploy to Base Sepolia

```bash
# From project root
yarn deploy --network baseSepolia
```

This will:
1. Prompt for your keystore password
2. Deploy all 4 contracts:
   - TapThatXRegistry
   - TapThatXProtocol
   - MockUSDC
   - USDCTapPayment
3. Export ABIs to `packages/nextjs/contracts/deployedContracts.ts`

## Start Frontend

```bash
# From project root
yarn start
```

Frontend will be available at `http://localhost:3000`

## Test the Flow

### 1. Register Chip
- Go to `/register`
- Connect wallet
- Tap NFC chip twice (once to read address, once to sign)
- Confirm transaction

### 2. Approve USDC
- Go to `/approve`
- Approve unlimited USDC spending
- Confirm transaction (one-time setup)

### 3. Make Payment
- Go to `/payment`
- Tap chip to authorize payment
- Payment executes via relayer (gasless!)

## Verify Deployment

Check Base Sepolia explorer for your deployed contracts:
```
https://sepolia.basescan.org/address/<CONTRACT_ADDRESS>
```

## Troubleshooting

**"Contracts not deployed"**
- Run deployment script again
- Check chain ID matches (84532 for Base Sepolia)

**"Chip not registered"**
- Go to `/register` first
- Make sure you're using the same chip

**"Insufficient allowance"**
- Go to `/approve` and grant approval
- Check allowance is > payment amount

**"Relayer failed"**
- Check relayer has gas on Base Sepolia
- Verify `RELAYER_PRIVATE_KEY` in `.env`

## Contract Addresses

After deployment, addresses will be in:
```
packages/nextjs/contracts/deployedContracts.ts
```

## Local Development

Test locally first:

```bash
# Terminal 1: Start local chain
yarn chain

# Terminal 2: Deploy locally
yarn deploy

# Terminal 3: Start frontend
yarn start
```

## Need to Redeploy?

Just run the deploy command again. New addresses will be auto-updated in frontend.

```bash
yarn deploy --network baseSepolia
```

## Production Checklist

- [ ] Replace MockUSDC with real USDC address
- [ ] Fund relayer with sufficient gas
- [ ] Test all flows on testnet
- [ ] Add rate limiting to relay API
- [ ] Monitor relayer balance
- [ ] Set up alerting for failed txs

## Support

Check the full migration guide: `MIGRATION_GUIDE.md`
