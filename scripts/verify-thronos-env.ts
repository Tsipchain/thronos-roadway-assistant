import "dotenv/config";
import { JsonRpcProvider } from "ethers";

const required = [
  "THRONOS_EVM_RPC_URL",
  "THRONOS_CHAIN_ID",
  "THRONOS_PLATFORM_PRIVATE_KEY",
] as const;

async function main() {
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    console.error(`Missing env: ${missing.join(", ")}`);
    process.exit(1);
  }

  const provider = new JsonRpcProvider(process.env.THRONOS_EVM_RPC_URL, Number(process.env.THRONOS_CHAIN_ID));
  const network = await provider.getNetwork();

  const configuredChainId = BigInt(String(process.env.THRONOS_CHAIN_ID));
  if (network.chainId !== configuredChainId) {
    console.error(`Chain id mismatch. RPC returned ${network.chainId}; env has ${configuredChainId}.`);
    process.exit(1);
  }

  console.log("Thronos EVM env OK");
  console.log(`RPC chainId: ${network.chainId}`);
  console.log(`Attestation: ${process.env.THRONOS_ATTESTATION_ENDPOINT || "disabled/not set"}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
