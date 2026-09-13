import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/getCurrentBusiness";

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
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

    const { id } =
      await context.params;

    // Match must belong to
    // the logged-in business.
    const match =
      await db.reconciliationMatch.findFirst({
        where: {
          id,

          bankTransaction: {
            businessId:
              business.id,
          },

          invoice: {
            businessId:
              business.id,
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

    if (
      match.bankTransaction.businessId !==
      business.id
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Unauthorized.",
        },
        {
          status: 403,
        }
      );
    }

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
                  businessId:
                    business.id,
                },

                invoice: {
                  businessId:
                    business.id,
                },
              },

              data: {
                status:
                  "REJECTED",
              },
            });

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