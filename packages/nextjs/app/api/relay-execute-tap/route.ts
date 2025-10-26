import { NextRequest, NextResponse } from "next/server";
import { createWalletClient, formatEther, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as chains from "viem/chains";
import deployedContracts from "~~/contracts/deployedContracts";
import { getAlchemyHttpUrl } from "~~/utils/scaffold-eth/networks";

export const maxDuration = 30;

// IMPORTANT: Store this in environment variables
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { owner, chip, chipSignature, timestamp, nonce, chainId, value } = body;

    // Validate inputs
    if (!owner || !chip || !chipSignature || !timestamp || !nonce || !chainId) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    if (!RELAYER_PRIVATE_KEY) {
      return NextResponse.json({ error: "Relayer not configured" }, { status: 500 });
    }

    // Get contracts for the specified chain
    const contracts = deployedContracts[chainId as keyof typeof deployedContracts] as any;
    if (!contracts?.TapThatXExecutor) {
      return NextResponse.json({ error: "Contracts not deployed on this network" }, { status: 400 });
    }

    // Get chain config from viem
    const chainConfig = Object.values(chains).find((c: any) => c.id === chainId);
    if (!chainConfig) {
      return NextResponse.json({ error: "Unsupported chain" }, { status: 400 });
    }

    // Setup wallet client
    const account = privateKeyToAccount(RELAYER_PRIVATE_KEY as `0x${string}`);
    const rpcUrl = getAlchemyHttpUrl(chainId) || chainConfig.rpcUrls.default.http[0];

    const client = createWalletClient({
      account,
      chain: chainConfig,
      transport: http(rpcUrl),
    }).extend(publicActions);

    // Detect if this is an Aave rebalancer action by checking the target contract
    const config = await client.readContract({
      address: contracts.TapThatXConfiguration.address,
      abi: contracts.TapThatXConfiguration.abi,
      functionName: "getConfiguration",
      args: [owner as `0x${string}`, chip as `0x${string}`],
    });

    // Check if target is Aave rebalancer (needs much more gas due to flash loan complexity)
    // Flash loan operations are extremely gas-intensive:
    // - Flash loan callback execution
    // - Aave debt repayment + interest calculations
    // - aToken withdrawal and burning
    // - Uniswap V2 swap (multiple token transfers)
    // - Flash loan repayment
    // Default estimation often underestimates, causing OutOfGas errors during swap
    const isAaveRebalancer =
      contracts.TapThatXAaveRebalancer &&
      (config as any).targetContract?.toLowerCase() === contracts.TapThatXAaveRebalancer.address?.toLowerCase();

    // Check if target is bridge extension (dual bridge operations need high gas)
    // Bridge extension operations are gas-intensive due to:
    // - WETH.transferFrom + withdraw
    // - Two L1StandardBridge.bridgeETHTo calls (OP + Base)
    // - Multiple EVM state changes across cross-chain messaging
    const isBridgeExtension =
      contracts.TapThatXBridgeETHViaWETH &&
      (config as any).targetContract?.toLowerCase() === contracts.TapThatXBridgeETHViaWETH.address?.toLowerCase();

    // Check relayer balance if value is being sent
    const valueToSend = value ? BigInt(value) : 0n;
    if (valueToSend > 0n) {
      const balance = await client.getBalance({ address: account.address });
      const estimatedGas = BigInt(1_500_000) * (await client.getGasPrice());
      const totalNeeded = valueToSend + estimatedGas;

      if (balance < totalNeeded) {
        return NextResponse.json(
          {
            error: `Insufficient relayer balance. Need ${formatEther(totalNeeded)} ETH (${formatEther(valueToSend)} bridge + ${formatEther(estimatedGas)} gas), have ${formatEther(balance)} ETH`,
          },
          { status: 500 },
        );
      }
    }

    // Call executeTap on TapThatXExecutor with appropriate gas limit
    const hash = await client.writeContract({
      address: contracts.TapThatXExecutor.address,
      abi: contracts.TapThatXExecutor.abi,
      functionName: "executeTap",
      args: [
        owner as `0x${string}`,
        chip as `0x${string}`,
        chipSignature as `0x${string}`,
        BigInt(timestamp),
        nonce as `0x${string}`, // bytes32
      ],
      value: valueToSend, // Will be 0n for bridge extension (WETH is pulled, not ETH sent)
      gas: isAaveRebalancer
        ? BigInt(1_500_000) // 1.5M gas for Aave flash loans
        : isBridgeExtension
          ? BigInt(3_000_000) // 3M gas for dual bridge operations (OP bridge: ~913k, Base bridge: ~650k, safety margin)
          : undefined, // Auto-estimate for others
    });

    // Wait for transaction receipt
    const receipt = await client.waitForTransactionReceipt({ hash });

    return NextResponse.json({
      success: true,
      transactionHash: hash,
      blockNumber: receipt.blockNumber.toString(),
    });
  } catch (error) {
    console.error("Execute tap relay error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Execution relay failed" },
      { status: 500 },
    );
  }
}
