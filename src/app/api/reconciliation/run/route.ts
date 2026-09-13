import { NextResponse } from "next/server";
import { runReconciliation } from "@/lib/runReconciliation";
import { getCurrentBusiness } from "@/lib/getCurrentBusiness";

export async function POST() {
  try {
    // Get logged-in user's business
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

    // Run reconciliation only
    // for logged-in business
    const result =
      await runReconciliation(
        business.id
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