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
    // ==========================================
    // AUTHENTICATED BUSINESS
    // ==========================================

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

    // ==========================================
    // SELECTED MATCH
    // ==========================================

    // Important:
    // Match must belong to the logged-in
    // business.
    const selectedMatch =
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

    if (!selectedMatch) {
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
      selectedMatch.status ===
      "CONFIRMED"
    ) {
      return NextResponse.json({
        success: true,
        message:
          "Match is already confirmed.",
      });
    }

    if (
      selectedMatch.status !==
      "SUGGESTED"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Only suggested matches can be confirmed.",
        },
        {
          status: 400,
        }
      );
    }

    const transaction =
      selectedMatch.bankTransaction;

    // Extra ownership protection
    if (
      transaction.businessId !==
      business.id
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

    // ==========================================
    // ALL SUGGESTED MATCHES FOR TRANSACTION
    // ==========================================

    const suggestedMatches =
      await db.reconciliationMatch.findMany({
        where: {
          bankTransactionId:
            transaction.id,

          status: "SUGGESTED",

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
          invoice: {
            include: {
              allocations: true,
            },
          },
        },

        orderBy: {
          createdAt: "asc",
        },
      });

    if (
      suggestedMatches.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "No suggested matches were found for this transaction.",
        },
        {
          status: 400,
        }
      );
    }

    // ==========================================
    // CUSTOMER SAFETY
    // ==========================================

    const customerIds =
      new Set(
        suggestedMatches.map(
          (item) =>
            item.invoice.customerId
        )
      );

    if (
      customerIds.size > 1
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Combined payment suggestions belong to different customers and cannot be confirmed together.",
        },
        {
          status: 400,
        }
      );
    }

    const transactionAmount =
      Number(transaction.amount);

    const allocationsToCreate: {
      matchId: string;
      invoiceId: string;
      amount: number;
      currentPaid: number;
      invoiceTotal: number;
    }[] = [];

    // ==========================================
    // BUILD ALLOCATIONS
    // ==========================================

    for (
      const match of
      suggestedMatches
    ) {
      const invoice =
        match.invoice;

      const currentPaid =
        invoice.allocations.reduce(
          (
            sum,
            allocation
          ) =>
            sum +
            Number(
              allocation.amount
            ),
          0
        );

      const balance =
        Number(
          invoice.totalAmount
        ) - currentPaid;

      if (balance <= 0) {
        return NextResponse.json(
          {
            success: false,
            message: `Invoice ${invoice.invoiceNumber} is already fully paid.`,
          },
          {
            status: 400,
          }
        );
      }

      const matchedAmount =
        Number(
          match.matchedAmount ??
            0
        );

      if (
        matchedAmount <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message: `Invalid matched amount for invoice ${invoice.invoiceNumber}.`,
          },
          {
            status: 400,
          }
        );
      }

      const amountToAllocate =
        Math.min(
          matchedAmount,
          balance
        );

      allocationsToCreate.push({
        matchId:
          match.id,

        invoiceId:
          invoice.id,

        amount:
          amountToAllocate,

        currentPaid,

        invoiceTotal:
          Number(
            invoice.totalAmount
          ),
      });
    }

    const totalAllocation =
      allocationsToCreate.reduce(
        (
          sum,
          allocation
        ) =>
          sum +
          allocation.amount,
        0
      );

    // ==========================================
    // FULL TRANSACTION MUST BE ALLOCATED
    // ==========================================

    if (
      Math.abs(
        totalAllocation -
          transactionAmount
      ) > 0.01
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            `Suggested allocations total ₹${totalAllocation.toFixed(
              2
            )}, but transaction amount is ₹${transactionAmount.toFixed(
              2
            )}. Please review the match before confirming.`,
        },
        {
          status: 400,
        }
      );
    }

    // ==========================================
    // DATABASE TRANSACTION
    // ==========================================

    const result =
      await db.$transaction(
        async (tx) => {
          const existingPayment =
            await tx.payment.findUnique({
              where: {
                bankTransactionId:
                  transaction.id,
              },
            });

          if (
            existingPayment
          ) {
            throw new Error(
              "A payment already exists for this bank transaction."
            );
          }

          // One payment for entire
          // bank transaction
          const payment =
            await tx.payment.create({
              data: {
                businessId:
                  business.id,

                customerId:
                  suggestedMatches[0]
                    .invoice
                    .customerId,

                bankTransactionId:
                  transaction.id,

                amount:
                  transactionAmount,

                paymentDate:
                  transaction.transactionDate,

                reference:
                  transaction.reference,

                source:
                  "BANK_TRANSFER",
              },
            });

          const allocations =
            [];

          // ======================================
          // PAYMENT ALLOCATIONS
          // ======================================

          for (
            const item of
            allocationsToCreate
          ) {
            const allocation =
              await tx.paymentAllocation.create({
                data: {
                  paymentId:
                    payment.id,

                  invoiceId:
                    item.invoiceId,

                  amount:
                    item.amount,
                },
              });

            allocations.push(
              allocation
            );

            const newTotalPaid =
              item.currentPaid +
              item.amount;

            const newStatus =
              newTotalPaid >=
              item.invoiceTotal -
                0.01
                ? "PAID"
                : "PARTIALLY_PAID";

            await tx.invoice.update({
              where: {
                id:
                  item.invoiceId,
              },

              data: {
                status:
                  newStatus,
              },
            });

            await tx.reconciliationMatch.update({
              where: {
                id:
                  item.matchId,
              },

              data: {
                status:
                  "CONFIRMED",
              },
            });
          }

          // ======================================
          // MARK TRANSACTION MATCHED
          // ======================================

          const updatedTransaction =
            await tx.bankTransaction.update({
              where: {
                id:
                  transaction.id,
              },

              data: {
                status:
                  "MATCHED",
              },
            });

          return {
            payment,
            allocations,

            transaction:
              updatedTransaction,

            confirmedMatches:
              allocationsToCreate.length,
          };
        }
      );

    return NextResponse.json({
      success: true,

      message:
        suggestedMatches.length >
        1
          ? `${suggestedMatches.length} invoice matches confirmed successfully.`
          : "Match confirmed successfully.",

      data: result,
    });
  } catch (error) {
    console.error(
      "CONFIRM MATCH ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "Failed to confirm match.",
      },
      {
        status: 500,
      }
    );
  }
}