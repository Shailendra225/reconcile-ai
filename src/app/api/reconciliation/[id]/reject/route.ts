import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getCurrentMembership } from "@/lib/getCurrentMembership";
import { canManageReconciliation } from "@/lib/permissions";

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
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
            "You do not have permission to reject reconciliation matches.",
        },
        {
          status: 403,
        }
      );
    }

    const businessId =
      membership.businessId;

    const { id } =
      await context.params;

    // ----------------------------------------
    // Match must belong to current workspace
    // ----------------------------------------

    const match =
      await db.reconciliationMatch.findFirst({
        where: {
          id,

          bankTransaction: {
            businessId,
          },

          invoice: {
            businessId,
          },
        },

        include: {
          bankTransaction: true,
          invoice: true,
        },
      });

    if (!match) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Reconciliation match not found.",
        },
        {
          status: 404,
        }
      );
    }

    // ----------------------------------------
    // Only suggested matches can be rejected
    // ----------------------------------------

    if (
      match.status !==
      "SUGGESTED"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Only suggested matches can be rejected.",
        },
        {
          status: 400,
        }
      );
    }

    // Extra workspace safety
    if (
      match.bankTransaction.businessId !==
        businessId ||
      match.invoice.businessId !==
        businessId
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized.",
        },
        {
          status: 403,
        }
      );
    }

    // ----------------------------------------
    // Reject related suggested matches
    // ----------------------------------------

    const result =
      await db.$transaction(
        async (tx) => {
          const rejected =
            await tx.reconciliationMatch.updateMany({
              where: {
                bankTransactionId:
                  match.bankTransactionId,

                status:
                  "SUGGESTED",

                bankTransaction: {
                  businessId,
                },

                invoice: {
                  businessId,
                },
              },

              data: {
                status:
                  "REJECTED",
              },
            });

          // ----------------------------------
          // Return transaction to unmatched
          // ----------------------------------

          await tx.bankTransaction.update({
            where: {
              id:
                match.bankTransactionId,
            },

            data: {
              status:
                "UNMATCHED",
            },
          });

          return {
            rejectedCount:
              rejected.count,
          };
        }
      );

    return NextResponse.json({
      success: true,

      message:
        result.rejectedCount > 1
          ? `${result.rejectedCount} related matches rejected successfully.`
          : "Match rejected successfully.",

      rejectedCount:
        result.rejectedCount,
    });
  } catch (error) {
    console.error(
      "REJECT MATCH ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "Failed to reject match.",
      },
      {
        status: 500,
      }
    );
  }
}