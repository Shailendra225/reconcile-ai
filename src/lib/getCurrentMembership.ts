import { getCurrentUser } from "@/lib/getCurrentUser";
import { db } from "@/lib/db";

export async function getCurrentMembership() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const membership = await db.businessMember.findFirst({
    where: {
      userId: user.id,
    },
    include: {
      business: true,
    },
  });

  if (!membership) {
    return null;
  }

  return {
    id: membership.id,
    role: membership.role,
    userId: membership.userId,
    businessId: membership.businessId,
    business: membership.business,
  };
}