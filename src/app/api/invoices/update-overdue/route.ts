import { NextResponse } from "next/server";

import { updateOverdueInvoices } from "@/lib/updateOverdueInvoices";
import { getCurrentMembership } from "@/lib/getCurrentMembership";
import { canManageInvoices } from "@/lib/permissions";

export async function POST() {
  try {
    // ----------------------------------------
    // Authentication + workspace membership
    // ----------------------------------------

    const membership =
      await getCurrentMembership();

    if (!membership) {
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

    // ----------------------------------------
    // Role permission
    //
    // OWNER / ADMIN / ACCOUNTANT = allowed
    // VIEWER = blocked
    // ----------------------------------------

    if (
      !canManageInvoices(
        membership.role
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You do not have permission to update invoice statuses.",
        },
        {
          status: 403,
        }
      );
    }

    // ----------------------------------------
    // Update overdue invoices only
    // for current workspace
    // ----------------------------------------

    const result =
      await updateOverdueInvoices(
        membership.businessId
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