import { NextRequest, NextResponse } from "next/server";
import { createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as chains from "viem/chains";
import deployedContracts from "~~/contracts/deployedContracts";

export const maxDuration = 30;

// IMPORTANT: Store this in environment variables
// Generate a new account and fund it with Sepolia ETH from faucet
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
const ALCHEMY_API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || process.env.ALCHEMY_API_KEY;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { owner, recipient, amount, chipSignature, timestamp, nonce, chainId } = body;

    // Validate inputs
    if (!owner || !recipient || !amount || !chipSignature || !timestamp || !nonce || !chainId) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    if (!RELAYER_PRIVATE_KEY) {
      return NextResponse.json({ error: "Relayer not configured" }, { status: 500 });
    }

    // Get contracts for the specified chain
    const contracts = deployedContracts[chainId as keyof typeof deployedContracts] as any;
    if (!contracts?.USDCTapPayment) {
      return NextResponse.json({ error: "Contracts not deployed on this network" }, { status: 400 });
    }

    // Get chain config from viem
    const chainConfig = Object.values(chains).find((c: any) => c.id === chainId);
    if (!chainConfig) {
      return NextResponse.json({ error: "Unsupported chain" }, { status: 400 });
    }

    // Setup wallet client
    const account = privateKeyToAccount(RELAYER_PRIVATE_KEY as `0x${string}`);
    const rpcUrl =
      ALCHEMY_API_KEY && chainConfig.name
        ? `https://${chainConfig.name.toLowerCase().replace(" ", "-")}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
        : chainConfig.rpcUrls.default.http[0];

    const client = createWalletClient({
      account,
      chain: chainConfig,
      transport: http(rpcUrl),
    }).extend(publicActions);

    // Call tapToPay on USDCTapPayment
    const hash = await client.writeContract({
      address: contracts.USDCTapPayment.address,
      abi: contracts.USDCTapPayment.abi,
      functionName: "tapToPay",
      args: [
        owner as `0x${string}`,
        recipient as `0x${string}`,
        BigInt(amount),
        chipSignature as `0x${string}`,
        BigInt(timestamp),
        nonce as `0x${string}`, // bytes32
      ],
    });

    // Wait for transaction receipt
    const receipt = await client.waitForTransactionReceipt({ hash });

    return NextResponse.json({
      success: true,
      transactionHash: hash,
      blockNumber: receipt.blockNumber.toString(),
    });
  } catch (error) {
    console.error("Relay error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Relay failed" }, { status: 500 });
  }
}
