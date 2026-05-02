import { getThronosEnv } from "./config";
import { JsonValue, sha256Hex, stableJson } from "./hash";

export type ThronosAttestationInput = {
  type: "roadside.service.completed" | "roadside.service.created" | "roadside.payment.escrowed" | string;
  subjectId: string;
  payload: Record<string, JsonValue>;
  metadata?: Record<string, JsonValue>;
};

export type ThronosAttestationResult = {
  ok: boolean;
  hash: string;
  canonicalPayload: string;
  endpoint?: string;
  txId?: string;
  raw?: unknown;
};

export function buildAttestationPayload(input: ThronosAttestationInput) {
  return {
    type: input.type,
    subjectId: input.subjectId,
    payload: input.payload,
    metadata: input.metadata ?? {},
    algorithm: "sha256",
    createdAt: new Date().toISOString(),
  } satisfies Record<string, JsonValue>;
}

export async function attestOnThronosNode(input: ThronosAttestationInput): Promise<ThronosAttestationResult> {
  const env = getThronosEnv();
  const payload = buildAttestationPayload(input);
  const canonicalPayload = stableJson(payload);
  const hash = sha256Hex(canonicalPayload);

  if (!env.attestationEnabled || !env.attestationEndpoint) {
    return { ok: false, hash, canonicalPayload };
  }

  const response = await fetch(env.attestationEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(env.attestationApiKey ? { Authorization: `Bearer ${env.attestationApiKey}`, "x-api-key": env.attestationApiKey } : {}),
    },
    body: JSON.stringify({
      hash,
      algorithm: "sha256",
      type: input.type,
      subjectId: input.subjectId,
      payload,
    }),
  });

  const raw = await response.json().catch(() => ({ status: response.status, statusText: response.statusText }));
  if (!response.ok) {
    throw new Error(`Thronos attestation failed: ${response.status} ${JSON.stringify(raw)}`);
  }

  const txId = typeof raw === "object" && raw && "tx_id" in raw ? String((raw as { tx_id: unknown }).tx_id) : undefined;
  return { ok: true, hash, canonicalPayload, endpoint: env.attestationEndpoint, txId, raw };
}
