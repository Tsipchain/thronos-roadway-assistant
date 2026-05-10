import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session || !canAccessTenant(session.user.role, session.user.tenantSlug, params.slug)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ message: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ message: "File must be an image" }, { status: 400 });
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ message: "File too large (max 5MB)" }, { status: 400 });
    }

    // Convert file to base64 data URL
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    // Update tenant logo
    const tenant = await prisma.partnerCompany.update({
      where: { slug: params.slug },
      data: {
        logoUrl: dataUrl,
      },
      select: {
        id: true,
        logoUrl: true,
      },
    });

    return NextResponse.json({
      message: "Logo uploaded successfully",
      logoUrl: tenant.logoUrl,
    });
  } catch (error) {
    console.error("Error uploading logo:", error);
    return NextResponse.json(
      { message: "Failed to upload logo" },
      { status: 500 }
    );
  }
}
