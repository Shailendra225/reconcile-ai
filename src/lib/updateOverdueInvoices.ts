import { db } from "@/lib/db";

const BUSINESS_ID =
  "cmtzqdk660000mw8iri2qo8m0";

export async function updateOverdueInvoices() {
  const now = new Date();

  const result =
    await db.invoice.updateMany({
      where: {
        businessId: BUSINESS_ID,

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