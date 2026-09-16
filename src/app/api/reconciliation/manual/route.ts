import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getCurrentMembership } from "@/lib/getCurrentMembership";
import { canManageReconciliation } from "@/lib/permissions";

export async function POST(request: Request) {
  try {
    // --------------------------------------------------
    // 1. Get current workspace membership
    // --------------------------------------------------

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

    // --------------------------------------------------
    // 2. Check reconciliation permission
    //
    // OWNER / ADMIN / ACCOUNTANT = allowed
    // VIEWER = blocked
    // --------------------------------------------------

    if (
      !canManageReconciliation(
        membership.role
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You do not have permission to manually reconcile transactions.",
        },
        {
          status: 403,
        }
      );
    }

    const businessId =
      membership.businessId;

    // --------------------------------------------------
    // 3. Read request body
    // --------------------------------------------------

    const body =
      await request.json();

    const transactionId = String(
      body.transactionId ?? ""
    ).trim();

    const invoiceId = String(
      body.invoiceId ?? ""
    ).trim();

    const allocationAmount = Number(
      body.allocationAmount
    );

    // --------------------------------------------------
    // 4. Basic validation
    // --------------------------------------------------

    if (!transactionId || !invoiceId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Transaction and invoice are required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Number.isFinite(
        allocationAmount
      ) ||
      allocationAmount <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Enter a valid allocation amount.",
        },
        {
          status: 400,
        }
      );
    }

    // --------------------------------------------------
    // 5. Find unmatched CREDIT transaction
    //    belonging to current workspace
    // --------------------------------------------------

    const bankTransaction =
      await db.bankTransaction.findFirst({
        where: {
          id: transactionId,
          businessId,
          direction: "CREDIT",
          status: "UNMATCHED",
        },
      });

    if (!bankTransaction) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Unmatched transaction not found.",
        },
        {
          status: 404,
        }
      );
    }

    // --------------------------------------------------
    // 6. Find open invoice belonging
    //    to current workspace
    // --------------------------------------------------

    const invoice =
      await db.invoice.findFirst({
        where: {
          id: invoiceId,
          businessId,

          status: {
            in: [
              "SENT",
              "PARTIALLY_PAID",
              "OVERDUE",
            ],
          },
        },

        include: {
          allocations: {
            select: {
              amount: true,
            },
          },

          customer: {
            select: {
              id: true,
            },
          },
        },
      });

    if (!invoice) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Open invoice not found.",
        },
        {
          status: 404,
        }
      );
    }

    // --------------------------------------------------
    // 7. Calculate invoice balance
    // --------------------------------------------------

    const invoiceTotal =
      Number(invoice.totalAmount);

    const alreadyPaid =
      invoice.allocations.reduce(
        (sum, allocation) =>
          sum +
          Number(allocation.amount),
        0
      );

    const invoiceBalance =
      Math.max(
        invoiceTotal - alreadyPaid,
        0
      );

    const transactionAmount =
      Number(bankTransaction.amount);

    if (invoiceBalance <= 0.001) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This invoice has no outstanding balance.",
        },
        {
          status: 400,
        }
      );
    }

    // --------------------------------------------------
    // 8. Validate allocation
    // --------------------------------------------------

    if (
      allocationAmount >
      invoiceBalance + 0.001
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Allocation amount cannot be greater than the invoice balance.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      allocationAmount >
      transactionAmount + 0.001
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Allocation amount cannot be greater than the transaction amount.",
        },
        {
          status: 400,
        }
      );
    }

    // --------------------------------------------------
    // 9. Calculate remaining customer credit
    // --------------------------------------------------

    const remainingCredit =
      Math.max(
        transactionAmount -
          allocationAmount,
        0
      );

    const newPaidAmount =
      alreadyPaid +
      allocationAmount;

    const invoiceIsPaid =
      newPaidAmount >=
      invoiceTotal - 0.001;

    // --------------------------------------------------
    // 10. Perform reconciliation atomically
    // --------------------------------------------------

    const result =
      await db.$transaction(
        async (tx) => {
          /*
           * Payment represents the COMPLETE
           * bank transaction.
           *
           * Example:
           *
           * Transaction = ₹7,000
           * Allocation  = ₹6,000
           *
           * Payment.amount = ₹7,000
           * Allocation     = ₹6,000
           * Credit         = ₹1,000
           */

          const payment =
            await tx.payment.create({
              data: {
                businessId,

                customerId:
                  invoice.customer.id,

                bankTransactionId:
                  bankTransaction.id,

                amount:
                  transactionAmount,

                paymentDate:
                  bankTransaction.transactionDate,

                reference:
                  bankTransaction.reference,

                source:
                  "BANK_TRANSFER",
              },
            });

          // ----------------------------------------------
          // Create invoice allocation
          // ----------------------------------------------

          const allocation =
            await tx.paymentAllocation.create({
              data: {
                paymentId:
                  payment.id,

                invoiceId:
                  invoice.id,

                amount:
                  allocationAmount,
              },
            });

          // ----------------------------------------------
          // Update invoice status
          // ----------------------------------------------

          await tx.invoice.update({
            where: {
              id: invoice.id,
            },

            data: {
              status:
                invoiceIsPaid
                  ? "PAID"
                  : "PARTIALLY_PAID",
            },
          });

          // ----------------------------------------------
          // Transaction is now processed.
          //
          // Any unused Payment amount remains
          // available as customer credit.
          // ----------------------------------------------

          await tx.bankTransaction.update({
            where: {
              id: bankTransaction.id,
            },

            data: {
              status: "MATCHED",
            },
          });

          return {
            paymentId:
              payment.id,

            allocationId:
              allocation.id,
          };
        }
      );

    // --------------------------------------------------
    // 11. Success response
    // --------------------------------------------------

    return NextResponse.json({
      success: true,

      message:
        remainingCredit > 0.001
          ? `Transaction matched successfully. ₹${remainingCredit.toFixed(
              2
            )} remains as unallocated customer credit.`
          : "Transaction manually matched successfully.",

      paymentId:
        result.paymentId,

      allocationId:
        result.allocationId,

      allocation: {
        transactionAmount,

        allocatedAmount:
          allocationAmount,

        remainingCredit,

        invoiceBalanceBeforeAllocation:
          invoiceBalance,

        invoiceBalanceAfterAllocation:
          Math.max(
            invoiceBalance -
              allocationAmount,
            0
          ),

        invoiceStatus:
          invoiceIsPaid
            ? "PAID"
            : "PARTIALLY_PAID",
      },
    });
  } catch (error) {
    console.error(
      "MANUAL RECONCILIATION ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to manually reconcile transaction.",
      },
      {
        status: 500,
      }
    );
  }
}