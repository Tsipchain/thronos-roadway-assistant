import { prisma } from "./prisma";

export interface SubscriptionStatus {
  isActive: boolean;
  isExpired: boolean;
  daysUntilExpiry: number | null;
  daysOverdue: number | null;
  isBlocked: boolean; // true if expired > 2 days
  message: string;
}

/**
 * Check if a company's subscription is active
 * Returns blocking status and applicable messages
 */
export async function checkCompanySubscription(
  companyId: string
): Promise<SubscriptionStatus> {
  const company = await prisma.partnerCompany.findUnique({
    where: { id: companyId },
    select: { planActiveUntil: true },
  });

  if (!company) {
    return {
      isActive: false,
      isExpired: true,
      daysUntilExpiry: null,
      daysOverdue: null,
      isBlocked: true,
      message: "Company not found",
    };
  }

  const now = new Date();

  if (!company.planActiveUntil) {
    return {
      isActive: false,
      isExpired: true,
      daysUntilExpiry: null,
      daysOverdue: null,
      isBlocked: true,
      message: "No subscription configured",
    };
  }

  if (company.planActiveUntil > now) {
    const daysUntil = Math.ceil(
      (company.planActiveUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    return {
      isActive: true,
      isExpired: false,
      daysUntilExpiry: daysUntil,
      daysOverdue: null,
      isBlocked: false,
      message: `Subscription active (expires in ${daysUntil} days)`,
    };
  }

  // Subscription has expired
  const daysOverdue = Math.floor(
    (now.getTime() - company.planActiveUntil.getTime()) / (1000 * 60 * 60 * 24)
  );

  const isBlocked = daysOverdue > 2;

  return {
    isActive: false,
    isExpired: true,
    daysUntilExpiry: null,
    daysOverdue,
    isBlocked,
    message: isBlocked
      ? `Service blocked: subscription expired ${daysOverdue} days ago`
      : `Warning: subscription expired ${daysOverdue} day(s) ago. Service will block in ${2 - daysOverdue} day(s).`,
  };
}

/**
 * Get subscription status for a technician's company
 */
export async function getTechnicianSubscriptionStatus(
  technicianUserId: string
): Promise<SubscriptionStatus | null> {
  const profile = await prisma.technicianProfile.findUnique({
    where: { userId: technicianUserId },
    select: { companyId: true },
  });

  if (!profile || !profile.companyId) {
    return null;
  }

  return checkCompanySubscription(profile.companyId);
}
