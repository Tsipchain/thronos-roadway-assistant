import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import * as dotenv from "dotenv";

dotenv.config();

const privateKey = process.env.THRONOS_DEPLOYER_PRIVATE_KEY || process.env.THRONOS_PLATFORM_PRIVATE_KEY || "";
const accounts = privateKey && privateKey.startsWith("0x") ? [privateKey] : [];
const thronosNetwork = {
  url: process.env.THRONOS_EVM_RPC_URL || "http://127.0.0.1:8545",
  accounts,
  ...(process.env.THRONOS_CHAIN_ID ? { chainId: Number(process.env.THRONOS_CHAIN_ID) } : {}),
};

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {},
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    thronos: thronosNetwork,
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
