import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTeamMembers, addTeamMember, removeTeamMember } from "@/lib/admin-service";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin of a tenant
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { tenant: true },
    });

    if (!user?.tenantId || !user.tenant) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const members = await getTeamMembers(user.tenantId);

    return NextResponse.json({ ok: true, members });
  } catch (error) {
    console.error("Get team error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin of a tenant
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { tenant: true },
    });

    if (!user?.tenantId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { name, phone, email, role, thrAddress } = await req.json();

    if (!name || !role) {
      return NextResponse.json(
        { error: "Missing name or role" },
        { status: 400 }
      );
    }

    const member = await addTeamMember(user.tenantId, {
      name,
      phone,
      email,
      role,
      thrAddress,
    });

    return NextResponse.json({ ok: true, member }, { status: 201 });
  } catch (error) {
    console.error("Add team member error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin of a tenant
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { tenant: true },
    });

    if (!user?.tenantId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { memberId } = await req.json();

    if (!memberId) {
      return NextResponse.json({ error: "Missing memberId" }, { status: 400 });
    }

    // Verify member belongs to this tenant
    const member = await prisma.tenantTeamMember.findFirst({
      where: { id: memberId, tenantId: user.tenantId },
    });

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const success = await removeTeamMember(user.tenantId, memberId);

    return NextResponse.json({ ok: success });
  } catch (error) {
    console.error("Remove team member error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
