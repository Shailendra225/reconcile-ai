import { getCurrentUser } from "@/lib/getCurrentUser";
import { db } from "@/lib/db";
import { cookies } from "next/headers";

export async function getCurrentMembership() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const cookieStore = await cookies();

  const activeBusinessId =
    cookieStore.get("activeBusinessId")?.value;

  let membership;

  if (activeBusinessId) {
    membership =
      await db.businessMember.findUnique({
        where: {
          businessId_userId: {
            businessId: activeBusinessId,
            userId: user.id,
          },
        },
        include: {
          business: true,
        },
      });
  } else {
    // Safe fallback for users who currently
    // belong to only one business.
    const memberships =
      await db.businessMember.findMany({
        where: {
          userId: user.id,
        },
        include: {
          business: true,
        },
        take: 2,
      });

    if (memberships.length !== 1) {
      return null;
    }

    membership = memberships[0];
  }

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