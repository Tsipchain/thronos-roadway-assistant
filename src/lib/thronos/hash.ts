import { createHash } from "crypto";
import { ethers } from "ethers";

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export function stableJson(value: JsonValue): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;

  const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`).join(",")}}`;
}

export function sha256Hex(value: JsonValue | string): string {
  const input = typeof value === "string" ? value : stableJson(value);
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function sha256Bytes32(value: JsonValue | string): string {
  return `0x${sha256Hex(value)}`;
}

export function requestIdToBytes32(requestId: string): string {
  return ethers.id(requestId);
}

export function vehicleToHash(input: { licensePlate?: string; vin?: string; make?: string; model?: string; year?: number | null }) {
  return sha256Bytes32({
    licensePlate: input.licensePlate ?? null,
    vin: input.vin ?? null,
    make: input.make ?? null,
    model: input.model ?? null,
    year: input.year ?? null,
  });
}
