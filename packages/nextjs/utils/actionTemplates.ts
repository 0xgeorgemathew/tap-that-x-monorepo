import { encodeFunctionData } from "viem";

/**
 * Action templates for building callData for common DeFi operations
 */

export interface ActionTemplate {
  id: string;
  name: string;
  description: string;
  category: "payment" | "defi" | "custom";
  buildCallData: (params: any) => { target: `0x${string}`; callData: `0x${string}`; value?: bigint };
}

// ERC20 ABI for common functions
const ERC20_ABI = [
  {
    name: "transferFrom",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

// Uniswap V2 Router ABI (simplified)
const UNISWAP_V2_ROUTER_ABI = [
  {
    name: "swapExactTokensForTokens",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
] as const;

/**
 * Generic ERC20 Transfer Template
 * Works with any ERC20 token
 */
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
      value: 0n,
    };
  },
};

/**
 * Uniswap Token Swap Template
 * Swap tokens on Uniswap V2
 */
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
      value: 0n,
    };
  },
};

/**
 * Custom Action Template
 * For advanced users to input their own callData
 */
export const customActionTemplate: ActionTemplate = {
  id: "custom",
  name: "Custom Action",
  description: "Custom contract interaction (advanced)",
  category: "custom",
  buildCallData: (params: { target: `0x${string}`; callData: `0x${string}`; value?: bigint }) => {
    return {
      target: params.target,
      callData: params.callData,
      value: params.value || 0n,
    };
  },
};

// Aave Rebalancer ABI for executeRebalance function
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
          { name: "targetHealthFactor", type: "uint256" },
          { name: "maxSlippage", type: "uint256" },
        ],
      },
    ],
    outputs: [],
  },
] as const;

/**
 * Aave Position Rebalancer Template
 * Rebalance Aave position via flash loan (automatically calculates optimal flash loan amount)
 */
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
      value: 0n,
    };
  },
};

// TapThatXBridgeETHViaWETH ABI (unwrap WETH and bridge to both OP + Base Sepolia)
// Automatically bridges maximum available WETH, owner receives on both L2s
const BRIDGE_ETH_VIA_WETH_ABI = [
  {
    name: "unwrapAndBridgeDual",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "owner", type: "address" },
      { name: "minGasLimitOP", type: "uint32" },
      { name: "minGasLimitBase", type: "uint32" },
    ],
    outputs: [],
  },
] as const;

/**
 * Bridge ETH via WETH Template
 * Unwraps user's WETH and bridges to both Base Sepolia + OP Sepolia (gasless)
 * Automatically bridges maximum available WETH (minimum of balance and allowance)
 * User receives ETH on both L2s at the same address
 */
export const bridgeETHTemplate: ActionTemplate = {
  id: "bridge-eth-sepolia-to-l2",
  name: "Bridge WETH to Base + OP Sepolia",
  description: "Unwrap and bridge all available WETH to both L2s (gasless)",
  category: "defi",
  buildCallData: (params: {
    bridgeExtensionAddress: `0x${string}`;
    owner: `0x${string}`;
    minGasLimitOP?: number;
    minGasLimitBase?: number;
  }) => {
    const callData = encodeFunctionData({
      abi: BRIDGE_ETH_VIA_WETH_ABI,
      functionName: "unwrapAndBridgeDual",
      args: [params.owner, params.minGasLimitOP || 200000, params.minGasLimitBase || 200000],
    });

    return {
      target: params.bridgeExtensionAddress,
      callData,
      value: 0n, // No ETH sent - WETH is pulled from user via approval!
    };
  },
};

/**
 * All available action templates
 */
export const actionTemplates: ActionTemplate[] = [
  erc20TransferTemplate,
  uniswapSwapTemplate,
  aaveRebalanceTemplate,
  bridgeETHTemplate,
  customActionTemplate,
];

/**
 * Get a template by ID
 */
export function getTemplateById(id: string): ActionTemplate | undefined {
  return actionTemplates.find(t => t.id === id);
}

/**
 * Format token amount with decimals
 * Example: formatTokenAmount("100", 6) => 100000000n (100 USDC with 6 decimals)
 */
export function formatTokenAmount(amount: string, decimals: number): bigint {
  const [whole, fraction = ""] = amount.split(".");
  const paddedFraction = fraction.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(whole + paddedFraction);
}

/**
 * Parse token amount to human-readable
 * Example: parseTokenAmount(100000000n, 6) => "100.00"
 */
export function parseTokenAmount(amount: bigint, decimals: number): string {
  const amountStr = amount.toString().padStart(decimals + 1, "0");
  const whole = amountStr.slice(0, -decimals) || "0";
  const fraction = amountStr.slice(-decimals).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}
