import { ethers } from "ethers";
import { getThronosEnv } from "./config";
import { requestIdToBytes32 } from "./hash";
import { REWARD_VAULT_ABI, ROADSIDE_ESCROW_ABI, SERVICE_BOOK_ABI } from "./abis";

export function getThronosProvider() {
  const env = getThronosEnv();
  return new ethers.JsonRpcProvider(env.evmRpcUrl, env.chainId);
}

export function getThronosSigner() {
  const env = getThronosEnv();
  if (!env.platformPrivateKey) throw new Error("THRONOS_PLATFORM_PRIVATE_KEY or THRONOSCHAIN_PRIVATE_KEY is missing");
  return new ethers.Wallet(env.platformPrivateKey, getThronosProvider());
}

function requireAddress(address: string | undefined, name: string) {
  if (!address) throw new Error(`${name} is missing or invalid`);
  return address;
}

export function getRoadsideEscrowContract(signerOrProvider: ethers.Signer | ethers.Provider = getThronosSigner()) {
  const env = getThronosEnv();
  return new ethers.Contract(requireAddress(env.escrowContract, "THRONOS_ESCROW_CONTRACT"), ROADSIDE_ESCROW_ABI, signerOrProvider);
}

export function getServiceBookContract(signerOrProvider: ethers.Signer | ethers.Provider = getThronosSigner()) {
  const env = getThronosEnv();
  return new ethers.Contract(requireAddress(env.serviceBookContract, "THRONOS_SERVICEBOOK_CONTRACT"), SERVICE_BOOK_ABI, signerOrProvider);
}

export function getRewardVaultContract(signerOrProvider: ethers.Signer | ethers.Provider = getThronosSigner()) {
  const env = getThronosEnv();
  return new ethers.Contract(requireAddress(env.rewardVaultContract, "THRONOS_REWARD_VAULT_CONTRACT"), REWARD_VAULT_ABI, signerOrProvider);
}

export async function completeEscrowOnThronos(requestId: string): Promise<string> {
  const contract = getRoadsideEscrowContract();
  const tx = await contract.completeEscrow(requestIdToBytes32(requestId));
  const receipt = await tx.wait();
  return receipt.hash;
}

export async function recordServiceOnThronos(input: {
  requestId: string;
  vehicleHash: string;
  serviceTypeCode: number;
  metadataUri: string;
}): Promise<string> {
  const contract = getServiceBookContract();
  const tx = await contract.recordService(
    requestIdToBytes32(input.requestId),
    input.vehicleHash,
    input.serviceTypeCode,
    input.metadataUri,
  );
  const receipt = await tx.wait();
  return receipt.hash;
}

export async function rewardOnThronos(input: { walletAddress: string; amountWei: bigint; reason: string }): Promise<string> {
  const contract = getRewardVaultContract();
  const tx = await contract.reward(input.walletAddress, input.amountWei, input.reason);
  const receipt = await tx.wait();
  return receipt.hash;
}
