import "dotenv/config";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();

  console.log(`Deploying Thronos roadside contracts`);
  console.log(`Network chainId: ${network.chainId}`);
  console.log(`Deployer: ${deployer.address}`);

  const RoadsideEscrow = await hre.ethers.getContractFactory("RoadsideEscrow");
  const escrow = await RoadsideEscrow.deploy();
  await escrow.waitForDeployment();

  const ServiceBook = await hre.ethers.getContractFactory("ServiceBook");
  const serviceBook = await ServiceBook.deploy();
  await serviceBook.waitForDeployment();

  const rewardToken = process.env.THRONOS_REWARD_TOKEN_ADDRESS;
  let rewardVaultAddress: string | null = null;

  if (rewardToken && /^0x[a-fA-F0-9]{40}$/.test(rewardToken)) {
    const RewardVault = await hre.ethers.getContractFactory("RewardVault");
    const rewardVault = await RewardVault.deploy(rewardToken);
    await rewardVault.waitForDeployment();
    rewardVaultAddress = await rewardVault.getAddress();
  }

  const deployment = {
    network: hre.network.name,
    chainId: network.chainId.toString(),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      RoadsideEscrow: await escrow.getAddress(),
      ServiceBook: await serviceBook.getAddress(),
      RewardVault: rewardVaultAddress,
      RewardToken: rewardToken || null,
    },
  };

  mkdirSync("deployments", { recursive: true });
  mkdirSync(join("src", "contracts", "addresses"), { recursive: true });

  writeFileSync(join("deployments", `${hre.network.name}.json`), `${JSON.stringify(deployment, null, 2)}\n`);
  writeFileSync(join("src", "contracts", "addresses", `${hre.network.name}.json`), `${JSON.stringify(deployment, null, 2)}\n`);

  console.log(JSON.stringify(deployment, null, 2));
  console.log("Add these to .env:");
  console.log(`THRONOS_ESCROW_CONTRACT=${deployment.contracts.RoadsideEscrow}`);
  console.log(`THRONOS_SERVICEBOOK_CONTRACT=${deployment.contracts.ServiceBook}`);
  if (deployment.contracts.RewardVault) console.log(`THRONOS_REWARD_VAULT_CONTRACT=${deployment.contracts.RewardVault}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
