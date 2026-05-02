import { z } from "zod";

const addressRegex = /^0x[a-fA-F0-9]{40}$/;

function pick(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => value && value.trim().length > 0 && !value.includes("YOUR_"));
}

function optionalAddress(value: string | undefined): string | undefined {
  if (!value || value === "0x0000000000000000000000000000000000000000") return undefined;
  return addressRegex.test(value) ? value : undefined;
}

export const thronosEnvSchema = z.object({
  nodeUrl: z.string().url().optional(),
  gatewayUrl: z.string().url().optional(),
  evmRpcUrl: z.string().url(),
  chainId: z.coerce.number().int().positive(),
  chainName: z.string().default("Thronos EVM"),
  nativeSymbol: z.string().default("THR"),
  explorerUrl: z.string().url().optional(),
  platformWallet: z.string().regex(addressRegex).optional(),
  platformPrivateKey: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
  escrowContract: z.string().regex(addressRegex).optional(),
  serviceBookContract: z.string().regex(addressRegex).optional(),
  rewardVaultContract: z.string().regex(addressRegex).optional(),
  rewardTokenAddress: z.string().regex(addressRegex).optional(),
  attestationEnabled: z.boolean().default(true),
  attestationEndpoint: z.string().url().optional(),
  attestationApiKey: z.string().optional(),
});

export type ThronosEnv = z.infer<typeof thronosEnvSchema>;

export function getThronosEnv(): ThronosEnv {
  const nodeUrl = pick(process.env.THRONOS_NODE_URL);
  const attestationEndpoint = pick(
    process.env.THRONOS_ATTESTATION_ENDPOINT,
    nodeUrl ? `${nodeUrl.replace(/\/$/, "")}/api/commerce/attest` : undefined,
  );

  return thronosEnvSchema.parse({
    nodeUrl,
    gatewayUrl: pick(process.env.THRONOS_GATEWAY_URL),
    evmRpcUrl: pick(process.env.THRONOS_EVM_RPC_URL, process.env.NEXT_PUBLIC_THRONOS_EVM_RPC_URL, process.env.NEXT_PUBLIC_THRONOSCHAIN_RPC),
    chainId: pick(process.env.THRONOS_CHAIN_ID, process.env.NEXT_PUBLIC_THRONOS_CHAIN_ID),
    chainName: pick(process.env.NEXT_PUBLIC_THRONOS_CHAIN_NAME) ?? "Thronos EVM",
    nativeSymbol: pick(process.env.NEXT_PUBLIC_THRONOS_NATIVE_SYMBOL) ?? "THR",
    explorerUrl: pick(process.env.NEXT_PUBLIC_THRONOS_EXPLORER_URL),
    platformWallet: optionalAddress(pick(process.env.THRONOS_PLATFORM_WALLET)),
    platformPrivateKey: pick(process.env.THRONOS_PLATFORM_PRIVATE_KEY, process.env.THRONOSCHAIN_PRIVATE_KEY),
    escrowContract: optionalAddress(pick(process.env.THRONOS_ESCROW_CONTRACT, process.env.ESCROW_CONTRACT_ADDRESS)),
    serviceBookContract: optionalAddress(pick(process.env.THRONOS_SERVICEBOOK_CONTRACT, process.env.SERVICE_BOOK_CONTRACT_ADDRESS)),
    rewardVaultContract: optionalAddress(pick(process.env.THRONOS_REWARD_VAULT_CONTRACT, process.env.REWARD_TOKEN_ADDRESS)),
    rewardTokenAddress: optionalAddress(pick(process.env.THRONOS_REWARD_TOKEN_ADDRESS)),
    attestationEnabled: process.env.THRONOS_ATTESTATION_ENABLED !== "false",
    attestationEndpoint,
    attestationApiKey: pick(process.env.THRONOS_ATTESTATION_API_KEY, process.env.THRONOS_COMMERCE_API_KEY),
  });
}

export function getPublicThronosConfig() {
  const env = getThronosEnv();
  return {
    chainId: env.chainId,
    chainName: env.chainName,
    nativeCurrency: {
      name: env.nativeSymbol,
      symbol: env.nativeSymbol,
      decimals: 18,
    },
    rpcUrls: [env.evmRpcUrl],
    blockExplorerUrls: env.explorerUrl ? [env.explorerUrl] : [],
  };
}
