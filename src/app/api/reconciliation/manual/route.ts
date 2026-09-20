import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getCurrentMembership } from "@/lib/getCurrentMembership";
import { canManageReconciliation } from "@/lib/permissions";

export async function POST(request: Request) {
  try {
    // --------------------------------------------------
    // 1. Authentication + workspace membership
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
    // 2. Permission
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
    // 3. Request body
    // --------------------------------------------------

    const body =
      await request.json();

    const transactionId =
      typeof body.transactionId ===
      "string"
        ? body.transactionId.trim()
        : "";

    const invoiceId =
      typeof body.invoiceId ===
      "string"
        ? body.invoiceId.trim()
        : "";

    const allocationAmount =
      Number(
        body.allocationAmount
      );

    // --------------------------------------------------
    // 4. Basic validation
    // --------------------------------------------------

    if (
      !transactionId ||
      !invoiceId
    ) {
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
    // 5. Manual reconciliation
    //
    // All financial validation and writes happen inside
    // the SAME Serializable transaction.
    // --------------------------------------------------

    const result =
      await db.$transaction(
        async (tx) => {
          // --------------------------------------------
          // Fresh bank transaction state
          // --------------------------------------------

          const bankTransaction =
            await tx.bankTransaction.findFirst({
              where: {
                id:
                  transactionId,

                businessId,

                direction:
                  "CREDIT",

                status:
                  "UNMATCHED",
              },
            });

          if (!bankTransaction) {
            throw new Error(
              "TRANSACTION_NOT_FOUND"
            );
          }

          // --------------------------------------------
          // Extra duplicate-payment protection
          //
          // Payment.bankTransactionId is unique.
          // This also gives us a clearer error before
          // attempting to create another payment.
          // --------------------------------------------

          const existingPayment =
            await tx.payment.findUnique({
              where: {
                bankTransactionId:
                  bankTransaction.id,
              },

              select: {
                id: true,
              },
            });

          if (existingPayment) {
            throw new Error(
              "TRANSACTION_ALREADY_PROCESSED"
            );
          }

          // --------------------------------------------
          // Fresh invoice state
          // --------------------------------------------

          const invoice =
            await tx.invoice.findFirst({
              where: {
                id:
                  invoiceId,

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
            throw new Error(
              "INVOICE_NOT_FOUND"
            );
          }

          // --------------------------------------------
          // Fresh invoice balance
          // --------------------------------------------

          const invoiceTotal =
            Number(
              invoice.totalAmount
            );

          const alreadyPaid =
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

          const invoiceBalance =
            Math.max(
              invoiceTotal -
                alreadyPaid,
              0
            );

          if (
            invoiceBalance <=
            0.001
          ) {
            throw new Error(
              "NO_INVOICE_BALANCE"
            );
          }

          // --------------------------------------------
          // Transaction amount
          // --------------------------------------------

          const transactionAmount =
            Number(
              bankTransaction.amount
            );

          if (
            !Number.isFinite(
              transactionAmount
            ) ||
            transactionAmount <= 0
          ) {
            throw new Error(
              "INVALID_TRANSACTION_AMOUNT"
            );
          }

          // --------------------------------------------
          // Allocation validation
          // --------------------------------------------

          if (
            allocationAmount >
            invoiceBalance +
              0.001
          ) {
            throw new Error(
              "INVOICE_BALANCE_EXCEEDED"
            );
          }

          if (
            allocationAmount >
            transactionAmount +
              0.001
          ) {
            throw new Error(
              "TRANSACTION_AMOUNT_EXCEEDED"
            );
          }

          // --------------------------------------------
          // Resulting balances
          // --------------------------------------------

          const remainingCredit =
            Math.max(
              transactionAmount -
                allocationAmount,
              0
            );

          const invoiceBalanceAfter =
            Math.max(
              invoiceBalance -
                allocationAmount,
              0
            );

          const newPaidAmount =
            alreadyPaid +
            allocationAmount;

          const invoiceIsPaid =
            newPaidAmount >=
            invoiceTotal - 0.001;

          // --------------------------------------------
          // Create Payment
          //
          // IMPORTANT:
          // Payment represents the COMPLETE bank
          // transaction amount.
          //
          // Any amount not allocated to this invoice
          // remains available as customer credit.
          // --------------------------------------------

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

          // --------------------------------------------
          // Allocate requested amount to invoice
          // --------------------------------------------

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

          // --------------------------------------------
          // Update invoice
          // --------------------------------------------

          await tx.invoice.update({
            where: {
              id:
                invoice.id,
            },

            data: {
              status:
                invoiceIsPaid
                  ? "PAID"
                  : "PARTIALLY_PAID",
            },
          });

          // --------------------------------------------
          // Mark bank transaction processed
          // --------------------------------------------

          await tx.bankTransaction.update({
            where: {
              id:
                bankTransaction.id,
            },

            data: {
              status:
                "MATCHED",
            },
          });

          return {
            paymentId:
              payment.id,

            allocationId:
              allocation.id,

            transactionAmount,

            allocatedAmount:
              allocationAmount,

            remainingCredit,

            invoiceBalanceBefore:
              invoiceBalance,

            invoiceBalanceAfter,

            invoiceIsPaid,
          };
        },
        {
          isolationLevel:
            "Serializable",

          maxWait:
            5000,

          timeout:
            10000,
        }
      );

    // --------------------------------------------------
    // 6. Success
    // --------------------------------------------------

    return NextResponse.json({
      success: true,

      message:
        result.remainingCredit >
        0.001
          ? `Transaction matched successfully. ₹${result.remainingCredit.toFixed(
              2
            )} remains as unallocated customer credit.`
          : "Transaction manually matched successfully.",

      paymentId:
        result.paymentId,

      allocationId:
        result.allocationId,

      allocation: {
        transactionAmount:
          result.transactionAmount,

        allocatedAmount:
          result.allocatedAmount,

        remainingCredit:
          result.remainingCredit,

        invoiceBalanceBeforeAllocation:
          result.invoiceBalanceBefore,

        invoiceBalanceAfterAllocation:
          result.invoiceBalanceAfter,

        invoiceStatus:
          result.invoiceIsPaid
            ? "PAID"
            : "PARTIALLY_PAID",
      },
    });
  } catch (error) {
    console.error(
      "MANUAL RECONCILIATION ERROR:",
      error
    );

    // --------------------------------------------------
    // Business validation errors
    // --------------------------------------------------

    if (
      error instanceof Error
    ) {
      switch (
        error.message
      ) {
        case "TRANSACTION_NOT_FOUND":
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

        case "TRANSACTION_ALREADY_PROCESSED":
          return NextResponse.json(
            {
              success: false,
              message:
                "This bank transaction has already been processed.",
            },
            {
              status: 409,
            }
          );

        case "INVOICE_NOT_FOUND":
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

        case "NO_INVOICE_BALANCE":
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

        case "INVALID_TRANSACTION_AMOUNT":
          return NextResponse.json(
            {
              success: false,
              message:
                "The bank transaction amount is invalid.",
            },
            {
              status: 400,
            }
          );

        case "INVOICE_BALANCE_EXCEEDED":
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

        case "TRANSACTION_AMOUNT_EXCEEDED":
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
    }

    // --------------------------------------------------
    // Serializable transaction conflict
    // --------------------------------------------------

    if (
      typeof error ===
        "object" &&
      error !== null &&
      "code" in error &&
      error.code ===
        "P2034"
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "The transaction or invoice was updated at the same time. Please try again.",

          code:
            "TRANSACTION_CONFLICT",
        },
        {
          status: 409,
        }
      );
    }

    // --------------------------------------------------
    // Unique constraint race protection
    //
    // Most importantly protects unique
    // Payment.bankTransactionId.
    // --------------------------------------------------

    if (
      typeof error ===
        "object" &&
      error !== null &&
      "code" in error &&
      error.code ===
        "P2002"
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "This bank transaction has already been reconciled.",

          code:
            "DUPLICATE_RECONCILIATION",
        },
        {
          status: 409,
        }
      );
    }

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