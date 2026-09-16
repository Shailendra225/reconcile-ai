import { getCurrentMembership } from "@/lib/getCurrentMembership";

export async function getCurrentBusiness() {
  const membership =
    await getCurrentMembership();

  if (!membership) {
    return null;
  }

  return membership.business;
}