import { getCurrentUser } from "@/lib/getCurrentUser";
import { db } from "@/lib/db";

export async function getCurrentBusiness() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  return db.business.findUnique({
    where: {
      ownerId: user.id,
    },
  });
}