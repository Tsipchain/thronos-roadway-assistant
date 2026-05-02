import { NextResponse } from "next/server";
import { getPublicThronosConfig, getThronosProvider } from "@/lib/thronos";

export async function GET() {
  try {
    const config = getPublicThronosConfig();
    const provider = getThronosProvider();
    const network = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();

    return NextResponse.json({
      ok: true,
      config,
      rpc: {
        chainId: network.chainId.toString(),
        blockNumber,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown Thronos health error" },
      { status: 500 },
    );
  }
}
