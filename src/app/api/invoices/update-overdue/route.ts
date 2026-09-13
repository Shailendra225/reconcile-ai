import { NextResponse } from "next/server";

import { updateOverdueInvoices } from "@/lib/updateOverdueInvoices";
import { getCurrentBusiness } from "@/lib/getCurrentBusiness";

export async function POST() {
  try {
    const business =
      await getCurrentBusiness();

    if (!business) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }

    const result =
      await updateOverdueInvoices(
        business.id
      );

    return NextResponse.json({
      success: true,

      message:
        result.updated > 0
          ? `${result.updated} invoice${
              result.updated === 1
                ? ""
                : "s"
            } marked overdue.`
          : "No invoices needed overdue updates.",

      updated:
        result.updated,
    });
  } catch (error) {
    console.error(
      "UPDATE OVERDUE INVOICES ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to update overdue invoices.",
      },
      {
        status: 500,
      }
    );
  }
}