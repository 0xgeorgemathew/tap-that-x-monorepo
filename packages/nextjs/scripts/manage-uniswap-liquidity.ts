import { config } from "dotenv";
import { createPublicClient, createWalletClient, formatUnits, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

// Load environment variables from .env.local
config({ path: ".env.local" });

// Configuration
const PAIR_ADDRESS = "0x9A03E586C9B1df47f69E1951a5AC96Ee323591A8";
const USDT_ADDRESS = "0x0a215D8ba66387DCA84B284D18c3B4ec3de6E54a";
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";
const ROUTER_ADDRESS = "0x1689E7B1F10000AE47eBfE339a4f69dECd19F602";
const CHAINLINK_ETH_USD = "0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1" as `0x${string}`;

// ABIs
const PAIR_ABI = [
  {
    inputs: [],
    name: "getReserves",
    outputs: [
      { name: "_reserve0", type: "uint112" },
      { name: "_reserve1", type: "uint112" },
      { name: "_blockTimestampLast", type: "uint32" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "token0",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "token1",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
];

const ERC20_ABI = [
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
];

const CHAINLINK_ABI = [
  {
    inputs: [],
    name: "latestAnswer",
    outputs: [{ name: "", type: "int256" }],
    stateMutability: "view",
    type: "function",
  },
];

const ROUTER_ABI = [
  {
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "amountADesired", type: "uint256" },
      { name: "amountBDesired", type: "uint256" },
      { name: "amountAMin", type: "uint256" },
      { name: "amountBMin", type: "uint256" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    name: "addLiquidity",
    outputs: [
      { name: "amountA", type: "uint256" },
      { name: "amountB", type: "uint256" },
      { name: "liquidity", type: "uint256" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    name: "swapExactTokensForTokens",
    outputs: [{ name: "amounts", type: "uint256[]" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "reserveIn", type: "uint256" },
      { name: "reserveOut", type: "uint256" },
    ],
    name: "getAmountOut",
    outputs: [{ name: "amountOut", type: "uint256" }],
    stateMutability: "pure",
    type: "function",
  },
];

// Setup clients
const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

// BigInt square root helper (Babylonian method)
function sqrt(value: bigint): bigint {
  if (value < 0n) throw new Error("Square root of negative number");
  if (value < 2n) return value;

  let x = value;
  let y = (x + 1n) / 2n;

  while (y < x) {
    x = y;
    y = (x + value / x) / 2n;
  }

  return x;
}

// Lazy initialization for wallet client (only when needed)
function getWalletClient() {
  const privateKey = process.env.PRIVATE_KEY || process.env.RELAYER_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error(
      "PRIVATE_KEY or RELAYER_PRIVATE_KEY environment variable not set.\n" + "Set it with: export PRIVATE_KEY=0x...",
    );
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);

  return {
    client: createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(),
    }),
    account,
  };
}

// Helper: Get Chainlink oracle price
async function getChainlinkPrice(): Promise<number> {
  const latestAnswer = (await publicClient.readContract({
    address: CHAINLINK_ETH_USD,
    abi: CHAINLINK_ABI,
    functionName: "latestAnswer",
  })) as bigint;

  // Chainlink ETH/USD has 8 decimals: 393150791700 = $3931.50791700
  return Number(formatUnits(latestAnswer, 8));
}

// Helper: Get current reserves and price
async function getReservesAndPrice() {
  const [reserve0, reserve1] = (await publicClient.readContract({
    address: PAIR_ADDRESS,
    abi: PAIR_ABI,
    functionName: "getReserves",
  })) as [bigint, bigint, number];

  // Assuming token0 is USDT (6 decimals) and token1 is WETH (18 decimals)
  const usdtReserve = Number(formatUnits(reserve0, 6));
  const wethReserve = Number(formatUnits(reserve1, 18));
  const ethPriceInUsdt = usdtReserve / wethReserve;

  const oraclePrice = await getChainlinkPrice();

  console.log("\n=== Current Pool State ===");
  console.log(`USDT Reserve: ${usdtReserve.toFixed(6)} USDT`);
  console.log(`WETH Reserve: ${wethReserve.toFixed(6)} WETH`);
  console.log(`Pool Price: $${ethPriceInUsdt.toFixed(2)} USDT`);
  console.log(`Oracle Price: $${oraclePrice.toFixed(2)} USDT`);
  console.log(`Price Deviation: ${(((ethPriceInUsdt - oraclePrice) / oraclePrice) * 100).toFixed(2)}%`);

  return { reserve0, reserve1, usdtReserve, wethReserve, ethPriceInUsdt, oraclePrice };
}

// Helper: Approve token spending
async function approveToken(
  walletClient: ReturnType<typeof createWalletClient>,
  account: ReturnType<typeof privateKeyToAccount>,
  tokenAddress: `0x${string}`,
  amount: bigint,
) {
  const hash = await walletClient.writeContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [ROUTER_ADDRESS, amount],
    account,
    chain: baseSepolia,
  });

  await publicClient.waitForTransactionReceipt({ hash });
  console.log(`✓ Approved ${tokenAddress}: ${hash}`);

  // Wait 2 seconds for nonce to update
  await new Promise(resolve => setTimeout(resolve, 2000));
}

// 1. Add liquidity maintaining oracle price
async function addLiquidityMaintainPrice(usdtAmount: number) {
  console.log("\n=== Adding Liquidity (Maintain Oracle Price) ===");

  const { client: walletClient, account } = getWalletClient();
  const { oraclePrice } = await getReservesAndPrice();

  // Calculate WETH amount needed to maintain oracle price ratio
  const wethAmount = usdtAmount / oraclePrice;

  const usdtAmountWei = parseUnits(usdtAmount.toString(), 6);
  const wethAmountWei = parseUnits(wethAmount.toFixed(18), 18);

  console.log(`Adding: ${usdtAmount} USDT + ${wethAmount.toFixed(6)} WETH`);

  // Approve tokens
  await approveToken(walletClient, account, USDT_ADDRESS, usdtAmountWei);
  await approveToken(walletClient, account, WETH_ADDRESS, wethAmountWei);

  // Add liquidity with 1% slippage
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200); // 20 minutes
  const hash = await walletClient.writeContract({
    address: ROUTER_ADDRESS,
    abi: ROUTER_ABI,
    functionName: "addLiquidity",
    args: [
      USDT_ADDRESS,
      WETH_ADDRESS,
      usdtAmountWei,
      wethAmountWei,
      (usdtAmountWei * 99n) / 100n, // 1% slippage
      (wethAmountWei * 99n) / 100n,
      account.address,
      deadline,
    ],
  });

  await publicClient.waitForTransactionReceipt({ hash });
  console.log(`✓ Liquidity added: ${hash}`);

  await getReservesAndPrice();
}

// 2. Sync pool price to Chainlink oracle
async function syncToOracle() {
  console.log("\n=== Syncing Pool to Oracle Price ===");

  const { client: walletClient, account } = getWalletClient();
  const { reserve0, reserve1, ethPriceInUsdt, oraclePrice } = await getReservesAndPrice();
  const targetPrice = oraclePrice;

  // Check if pool price is already close to oracle (within 0.5%)
  const deviation = Math.abs(ethPriceInUsdt - oraclePrice) / oraclePrice;
  if (deviation < 0.005) {
    console.log("\n✓ Pool price already matches oracle (< 0.5% deviation)");
    return;
  }

  // With constant product: reserve0 * reserve1 = k
  // Price = (reserve0 / 10^6) / (reserve1 / 10^18) = (reserve0 * 10^12) / reserve1
  // Target: (reserve0_new * 10^12) / reserve1_new = targetPrice
  // Therefore: reserve0_new = targetPrice * reserve1_new / 10^12
  // Substituting into k: (targetPrice * reserve1_new / 10^12) * reserve1_new = k
  // Solving: reserve1_new^2 = k * 10^12 / targetPrice
  // reserve1_new = sqrt(k * 10^12 / targetPrice)

  const k = reserve0 * reserve1;
  // Convert targetPrice to BigInt with 8 decimals for precision
  const targetPriceBigInt = parseUnits(targetPrice.toFixed(8), 8);
  // reserve1_new = sqrt(k * 10^12 / targetPrice)
  // = sqrt(k * 10^12 * 10^8 / (targetPrice * 10^8))
  // = sqrt(k * 10^20 / targetPriceBigInt)
  const reserve1NewSquared = (k * 100_000_000_000_000_000_000n) / targetPriceBigInt; // 10^20
  const reserve1New = sqrt(reserve1NewSquared);

  if (ethPriceInUsdt < oraclePrice) {
    // Pool price too low - need to BUY WETH to increase price
    const wethToBuy = reserve1 - reserve1New;
    const usdtNeeded = (reserve0 * wethToBuy * 1000n) / ((reserve1 - wethToBuy) * 997n);

    console.log(`\nPool price too low - buying WETH`);
    console.log(`WETH to buy: ${formatUnits(wethToBuy, 18)} WETH`);
    console.log(`USDT needed: ${formatUnits(usdtNeeded, 6)} USDT`);

    await approveToken(walletClient, account, USDT_ADDRESS, usdtNeeded);

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
    const hash = await walletClient.writeContract({
      address: ROUTER_ADDRESS,
      abi: ROUTER_ABI,
      functionName: "swapExactTokensForTokens",
      args: [usdtNeeded, (wethToBuy * 95n) / 100n, [USDT_ADDRESS, WETH_ADDRESS], account.address, deadline],
    });

    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`✓ Swap executed: ${hash}`);
  } else {
    // Pool price too high - need to SELL WETH to decrease price
    const wethToSell = reserve1New - reserve1;

    console.log(`\nPool price too high - selling WETH`);
    console.log(`WETH to sell: ${formatUnits(wethToSell, 18)} WETH`);

    await approveToken(walletClient, account, WETH_ADDRESS, wethToSell);

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
    const hash = await walletClient.writeContract({
      address: ROUTER_ADDRESS,
      abi: ROUTER_ABI,
      functionName: "swapExactTokensForTokens",
      args: [wethToSell, 0n, [WETH_ADDRESS, USDT_ADDRESS], account.address, deadline],
    });

    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`✓ Swap executed: ${hash}`);
  }

  await getReservesAndPrice();
}

// Main menu
async function main() {
  const action = process.argv[2];

  switch (action) {
    case "status":
      await getReservesAndPrice();
      break;

    case "add-liquidity": {
      const usdtAmount = parseFloat(process.argv[3] || "100");
      await addLiquidityMaintainPrice(usdtAmount);
      break;
    }

    case "sync":
      await syncToOracle();
      break;

    default:
      console.log(`
Usage:
  npx tsx scripts/manage-uniswap-liquidity.ts <action> [amount]

Actions:
  status              - Show current pool state and oracle price
  add-liquidity [n]   - Add liquidity maintaining oracle price (default: 100 USDT)
  sync                - Sync pool price to Chainlink oracle

Examples:
  npx tsx scripts/manage-uniswap-liquidity.ts status
  npx tsx scripts/manage-uniswap-liquidity.ts add-liquidity 500
  npx tsx scripts/manage-uniswap-liquidity.ts sync
      `);
  }
}

main().catch(console.error);
