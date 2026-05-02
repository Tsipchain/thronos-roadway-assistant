/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {},
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" }
    ]
  },
  env: {
    NEXT_PUBLIC_MAPBOX_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
    NEXT_PUBLIC_GOOGLE_MAPS_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY,
    NEXT_PUBLIC_THRONOS_EVM_RPC_URL: process.env.NEXT_PUBLIC_THRONOS_EVM_RPC_URL || process.env.THRONOS_EVM_RPC_URL,
    NEXT_PUBLIC_THRONOS_CHAIN_ID: process.env.NEXT_PUBLIC_THRONOS_CHAIN_ID || process.env.THRONOS_CHAIN_ID,
    NEXT_PUBLIC_THRONOS_CHAIN_NAME: process.env.NEXT_PUBLIC_THRONOS_CHAIN_NAME || "Thronos EVM",
    NEXT_PUBLIC_THRONOS_NATIVE_SYMBOL: process.env.NEXT_PUBLIC_THRONOS_NATIVE_SYMBOL || "THR",
    NEXT_PUBLIC_THRONOS_EXPLORER_URL: process.env.NEXT_PUBLIC_THRONOS_EXPLORER_URL,
    NEXT_PUBLIC_STRIPE_PK: process.env.NEXT_PUBLIC_STRIPE_PK,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001",
  },
};

module.exports = nextConfig;
