import { NextResponse } from "next/server";

import { runReconciliation } from "@/lib/runReconciliation";
import { getCurrentMembership } from "@/lib/getCurrentMembership";
import { canManageReconciliation } from "@/lib/permissions";

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
      !canManageReconciliation(
        membership.role
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You do not have permission to run reconciliation.",
        },
        {
          status: 403,
        }
      );
    }

    // ----------------------------------------
    // Run reconciliation only for
    // current workspace
    // ----------------------------------------

    const result =
      await runReconciliation(
        membership.businessId
      );

    return NextResponse.json({
      success: true,

      message:
        "Reconciliation scan completed.",

      ...result,
    });
  } catch (error) {
    console.error(
      "RECONCILIATION RUN ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "Failed to run reconciliation.",
      },
      {
        status: 500,
      }
    );
  }
}