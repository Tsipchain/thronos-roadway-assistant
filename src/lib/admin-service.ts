import { prisma } from "./prisma";

export interface DashboardMetrics {
  totalRequests: number;
  pendingRequests: number;
  completedRequests: number;
  totalRevenue: number;
  averageRating: number;
  teamSize: number;
  revenueByDay: Array<{ date: string; revenue: number }>;
  topTechnicians: Array<{ id: string; name: string; completedJobs: number; rating: number }>;
  customerSatisfaction: number;
}

export interface TeamMember {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  role: string;
  isActive: boolean;
  totalEarned: number;
  thrAddress?: string;
  thrBalance: number;
  specialties?: string[];
}

export async function getTenantMetrics(
  tenantId: string,
  daysBack: number = 30
): Promise<DashboardMetrics> {
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

  // Get all metrics
  const [requests, completedRequests, payments, technicians, reviews] = await Promise.all([
    prisma.serviceRequest.count({
      where: { tenantId, createdAt: { gte: since } },
    }),
    prisma.serviceRequest.count({
      where: { tenantId, status: "COMPLETED", createdAt: { gte: since } },
    }),
    prisma.payment.findMany({
      where: {
        request: { tenantId },
        status: "COMPLETED",
        createdAt: { gte: since },
      },
    }),
    prisma.tenantTeamMember.findMany({
      where: { tenantId, isActive: true },
    }),
    prisma.review.findMany({
      where: {
        request: { tenantId },
        createdAt: { gte: since },
      },
    }),
  ]);

  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
  const avgRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

  // Get daily revenue breakdown
  const dailyRevenue = new Map<string, number>();
  payments.forEach((p) => {
    const date = p.createdAt.toISOString().split("T")[0];
    dailyRevenue.set(date, (dailyRevenue.get(date) || 0) + p.amount);
  });

  const revenueByDay = Array.from(dailyRevenue.entries())
    .map(([date, revenue]) => ({ date, revenue }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14); // Last 14 days

  // Get top technicians
  const topTechs = await prisma.user.findMany({
    where: {
      technicianProfile: { companyId: tenantId },
    },
    include: {
      assignedRequests: {
        where: { status: "COMPLETED", createdAt: { gte: since } },
      },
      receivedReviews: {
        where: { createdAt: { gte: since } },
      },
    },
    orderBy: {
      rewardBalance: "desc",
    },
    take: 5,
  });

  const topTechnicians = topTechs.map((tech) => ({
    id: tech.id,
    name: tech.name,
    completedJobs: tech.assignedRequests.length,
    rating:
      tech.receivedReviews.length > 0
        ? tech.receivedReviews.reduce((sum, r) => sum + r.rating, 0) / tech.receivedReviews.length
        : 5.0,
  }));

  return {
    totalRequests: requests,
    pendingRequests: requests - completedRequests,
    completedRequests,
    totalRevenue,
    averageRating: avgRating,
    teamSize: technicians.length,
    revenueByDay,
    topTechnicians,
    customerSatisfaction: avgRating * 20, // Convert 5-star to percentage
  };
}

export async function getTeamMembers(tenantId: string): Promise<TeamMember[]> {
  const members = await prisma.tenantTeamMember.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  });

  // Also get Users who are technicians for this tenant
  const techUsers = await prisma.user.findMany({
    where: {
      technicianProfile: { companyId: tenantId },
    },
    include: {
      technicianProfile: true,
    },
  });

  return [
    ...members.map((m) => ({
      id: m.id,
      name: m.name,
      phone: m.phone || undefined,
      email: m.email || undefined,
      role: m.role,
      isActive: m.isActive,
      totalEarned: m.totalEarned,
      thrAddress: m.thrAddress || undefined,
      thrBalance: m.thrBalance,
    })),
    ...techUsers.map((u) => ({
      id: u.id,
      name: u.name,
      phone: u.phone || undefined,
      email: u.email || undefined,
      role: "TECHNICIAN",
      isActive: u.technicianProfile?.isAvailable || false,
      totalEarned: u.rewardBalance,
      thrAddress: u.walletAddress || undefined,
      thrBalance: 0,
      specialties: u.technicianProfile?.specialties || [],
    })),
  ];
}

export async function addTeamMember(
  tenantId: string,
  data: {
    name: string;
    phone?: string;
    email?: string;
    role: string;
    thrAddress?: string;
  }
): Promise<TeamMember> {
  const member = await prisma.tenantTeamMember.create({
    data: {
      tenantId,
      name: data.name,
      phone: data.phone,
      email: data.email,
      role: data.role,
      thrAddress: data.thrAddress,
    },
  });

  return {
    id: member.id,
    name: member.name,
    phone: member.phone || undefined,
    email: member.email || undefined,
    role: member.role,
    isActive: member.isActive,
    totalEarned: member.totalEarned,
    thrAddress: member.thrAddress || undefined,
    thrBalance: member.thrBalance,
  };
}

export async function removeTeamMember(
  tenantId: string,
  memberId: string
): Promise<boolean> {
  try {
    await prisma.tenantTeamMember.update({
      where: { id: memberId },
      data: { isActive: false },
    });
    return true;
  } catch {
    return false;
  }
}

export async function getTenantRequests(
  tenantId: string,
  status?: string,
  limit: number = 100
) {
  return prisma.serviceRequest.findMany({
    where: {
      tenantId,
      ...(status && { status }),
    },
    include: {
      customer: { select: { name: true, phone: true } },
      technician: { select: { name: true, phone: true } },
      vehicle: true,
      payment: true,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getTenantAnalytics(tenantId: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [requests, completedCount, avgTimeToComplete, satisfactionScores] = await Promise.all([
    prisma.serviceRequest.findMany({
      where: { tenantId, createdAt: { gte: thirtyDaysAgo } },
      include: { payment: true, review: true },
    }),
    prisma.serviceRequest.count({
      where: { tenantId, status: "COMPLETED", createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.serviceRequest.findMany({
      where: { tenantId, status: "COMPLETED", completedAt: { not: null } },
      select: { createdAt: true, completedAt: true },
      take: 100,
    }),
    prisma.review.findMany({
      where: { request: { tenantId }, createdAt: { gte: thirtyDaysAgo } },
      select: { rating: true },
    }),
  ]);

  // Calculate average completion time
  let avgCompletionTime = 0;
  if (avgTimeToComplete.length > 0) {
    const totalTime = avgTimeToComplete.reduce((sum, r) => {
      if (r.completedAt) {
        return sum + (r.completedAt.getTime() - r.createdAt.getTime());
      }
      return sum;
    }, 0);
    avgCompletionTime = Math.round(totalTime / avgTimeToComplete.length / (1000 * 60)); // in minutes
  }

  // Calculate satisfaction
  let avgSatisfaction = 0;
  if (satisfactionScores.length > 0) {
    avgSatisfaction =
      satisfactionScores.reduce((sum, r) => sum + r.rating, 0) / satisfactionScores.length;
  }

  const totalRevenue = requests
    .filter((r) => r.payment?.status === "COMPLETED")
    .reduce((sum, r) => sum + (r.payment?.amount || 0), 0);

  return {
    period: "30_days",
    totalRequests: requests.length,
    completedRequests: completedCount,
    completionRate: requests.length > 0 ? (completedCount / requests.length) * 100 : 0,
    avgCompletionTimeMinutes: avgCompletionTime,
    totalRevenue,
    avgRevenuePerRequest: requests.length > 0 ? totalRevenue / requests.length : 0,
    customerSatisfaction: avgSatisfaction,
    uniqueCustomers: new Set(requests.map((r) => r.customerId)).size,
  };
}
