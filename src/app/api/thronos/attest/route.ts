import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { attestOnThronosNode } from "@/lib/thronos";

const jsonValue: z.ZodType<any> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValue), z.record(jsonValue)]),
);

const attestSchema = z.object({
  type: z.string().min(3),
  subjectId: z.string().min(1),
  payload: z.record(jsonValue),
  metadata: z.record(jsonValue).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = attestSchema.parse(await req.json());
    const result = await attestOnThronosNode(body);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid attestation payload", details: error.flatten() }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Attestation failed" },
      { status: 500 },
    );
  }
}
