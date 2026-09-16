import type {
  SubscriptionPlan,
} from "@/generated/prisma/client";

export const PLAN_LIMITS = {
  FREE: {
    teamMembers: 1,
    monthlyTransactions: 100,
  },

  STARTER: {
    teamMembers: 3,
    monthlyTransactions: 1000,
  },

  PRO: {
    teamMembers: 10,
    monthlyTransactions: 10000,
  },
} satisfies Record<
  SubscriptionPlan,
  {
    teamMembers: number;
    monthlyTransactions: number;
  }
>;

export function getPlanLimits(
  plan: SubscriptionPlan
) {
  return PLAN_LIMITS[plan];
}