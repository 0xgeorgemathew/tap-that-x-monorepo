import { NextRequest, NextResponse } from "next/server";
import { createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import deployedContracts from "~~/contracts/deployedContracts";

// IMPORTANT: Store this in environment variables
// Generate a new account and fund it with Sepolia ETH from faucet
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
const ALCHEMY_API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || process.env.ALCHEMY_API_KEY;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { owner, recipient, amount, deadline, permitSignature, chipSignature, timestamp, nonce } = body;

    // Validate inputs
    if (!owner || !recipient || !amount || !deadline || !permitSignature || !chipSignature || !timestamp || !nonce) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    if (!RELAYER_PRIVATE_KEY) {
      return NextResponse.json({ error: "Relayer not configured" }, { status: 500 });
    }

    // Get chain config
    const chainId = sepolia.id;
    const contracts = deployedContracts[chainId as keyof typeof deployedContracts];

    if (!contracts?.USDCPaymentProcessor) {
      return NextResponse.json({ error: "Contracts not deployed on this network" }, { status: 500 });
    }

    // Setup wallet client
    const account = privateKeyToAccount(RELAYER_PRIVATE_KEY as `0x${string}`);
    const rpcUrl = ALCHEMY_API_KEY
      ? `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
      : sepolia.rpcUrls.default.http[0];

    const client = createWalletClient({
      account,
      chain: sepolia,
      transport: http(rpcUrl),
    }).extend(publicActions);

    // Call executePermitPayment on USDCPaymentProcessor
    const hash = await client.writeContract({
      address: contracts.USDCPaymentProcessor.address,
      abi: contracts.USDCPaymentProcessor.abi,
      functionName: "executePermitPayment",
      args: [
        owner as `0x${string}`,
        recipient as `0x${string}`,
        BigInt(amount),
        BigInt(deadline),
        permitSignature.v,
        permitSignature.r as `0x${string}`,
        permitSignature.s as `0x${string}`,
        chipSignature as `0x${string}`,
        BigInt(timestamp),
        nonce as `0x${string}`,
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
