import { db } from "@/lib/db";

export async function updateOverdueInvoices(
  businessId: string
) {
  const now = new Date();

  const result =
    await db.invoice.updateMany({
      where: {
        businessId,
        status: "SENT",
        dueDate: {
          lt: now,
        },
      },

      data: {
        status: "OVERDUE",
      },
    });

  return {
    updated: result.count,
  };
}