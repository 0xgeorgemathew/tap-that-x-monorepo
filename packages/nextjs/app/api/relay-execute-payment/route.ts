import { NextRequest, NextResponse } from "next/server";
import { createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as chains from "viem/chains";
import deployedContracts from "~~/contracts/deployedContracts";
import { getAlchemyHttpUrl } from "~~/utils/scaffold-eth/networks";

export const maxDuration = 30;

// Relayer private key from environment
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { payer, payerChip, payee, payeeChip, token, amount, timestamp, nonce, payerSignature, chainId } = body;

    // Validate inputs
    if (
      !payer ||
      !payerChip ||
      !payee ||
      !payeeChip ||
      !token ||
      !amount ||
      !timestamp ||
      !nonce ||
      !payerSignature ||
      !chainId
    ) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    if (!RELAYER_PRIVATE_KEY) {
      return NextResponse.json({ error: "Relayer not configured" }, { status: 500 });
    }

    // Get contracts for the specified chain
    const contracts = deployedContracts[chainId as keyof typeof deployedContracts] as any;
    if (!contracts?.TapThatXPaymentTerminal) {
      return NextResponse.json({ error: "Payment terminal not deployed on this network" }, { status: 400 });
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

    // Build PaymentAuthorization struct
    const paymentAuth = {
      payer: payer as `0x${string}`,
      payerChip: payerChip as `0x${string}`,
      payee: payee as `0x${string}`,
      payeeChip: payeeChip as `0x${string}`,
      token: token as `0x${string}`,
      amount: BigInt(amount),
      timestamp: BigInt(timestamp),
      nonce: nonce as `0x${string}`,
    };

    // Call executePayment on TapThatXPaymentTerminal
    const hash = await client.writeContract({
      address: contracts.TapThatXPaymentTerminal.address,
      abi: contracts.TapThatXPaymentTerminal.abi,
      functionName: "executePayment",
      args: [paymentAuth, payerSignature as `0x${string}`],
    });

    // Wait for transaction receipt
    const receipt = await client.waitForTransactionReceipt({ hash });

    return NextResponse.json({
      success: true,
      transactionHash: hash,
      blockNumber: receipt.blockNumber.toString(),
    });
  } catch (error) {
    console.error("Payment execution relay error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Payment execution failed" },
      { status: 500 },
    );
  }
}
