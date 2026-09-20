import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getCurrentMembership } from "@/lib/getCurrentMembership";
import { canManageReconciliation } from "@/lib/permissions";

export async function POST(request: Request) {
  try {
    // --------------------------------------------------
    // AUTHENTICATION + WORKSPACE MEMBERSHIP
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
    // ROLE PERMISSION
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
            "You do not have permission to apply customer credit.",
        },
        {
          status: 403,
        }
      );
    }

    const businessId =
      membership.businessId;

    // --------------------------------------------------
    // REQUEST BODY
    // --------------------------------------------------

    const body =
      await request.json();

    const paymentId =
      typeof body.paymentId === "string"
        ? body.paymentId.trim()
        : "";

    const invoiceId =
      typeof body.invoiceId === "string"
        ? body.invoiceId.trim()
        : "";

    const allocationAmount =
      Number(
        body.allocationAmount
      );

    if (
      !paymentId ||
      !invoiceId
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Payment and invoice are required.",
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
    // APPLY CREDIT
    //
    // SERIALIZABLE prevents two concurrent requests
    // from spending the same remaining credit.
    // --------------------------------------------------

    const result =
      await db.$transaction(
        async (tx) => {
          // --------------------------------------------
          // Fresh payment state INSIDE transaction
          // --------------------------------------------

          const payment =
            await tx.payment.findFirst({
              where: {
                id:
                  paymentId,

                businessId,
              },

              include: {
                allocations: {
                  select: {
                    amount: true,
                  },
                },
              },
            });

          if (!payment) {
            throw new Error(
              "PAYMENT_NOT_FOUND"
            );
          }

          if (
            !payment.customerId
          ) {
            throw new Error(
              "PAYMENT_NO_CUSTOMER"
            );
          }

          // --------------------------------------------
          // Fresh available credit calculation
          // --------------------------------------------

          const paymentAmount =
            Number(
              payment.amount
            );

          const alreadyAllocated =
            payment.allocations.reduce(
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

          const availableCredit =
            Math.max(
              paymentAmount -
                alreadyAllocated,
              0
            );

          if (
            availableCredit <=
            0.001
          ) {
            throw new Error(
              "NO_AVAILABLE_CREDIT"
            );
          }

          // --------------------------------------------
          // Fresh invoice state INSIDE transaction
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
              },
            });

          if (!invoice) {
            throw new Error(
              "INVOICE_NOT_FOUND"
            );
          }

          // --------------------------------------------
          // Same-customer protection
          // --------------------------------------------

          if (
            invoice.customerId !==
            payment.customerId
          ) {
            throw new Error(
              "CUSTOMER_MISMATCH"
            );
          }

          // --------------------------------------------
          // Fresh invoice balance calculation
          // --------------------------------------------

          const invoiceTotal =
            Number(
              invoice.totalAmount
            );

          const invoiceAlreadyPaid =
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
                invoiceAlreadyPaid,
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
          // Allocation validation
          // --------------------------------------------

          if (
            allocationAmount >
            availableCredit +
              0.001
          ) {
            throw new Error(
              "CREDIT_EXCEEDED"
            );
          }

          if (
            allocationAmount >
            invoiceBalance +
              0.001
          ) {
            throw new Error(
              "INVOICE_BALANCE_EXCEEDED"
            );
          }

          // --------------------------------------------
          // Calculate resulting balances
          // --------------------------------------------

          const invoiceBalanceAfter =
            Math.max(
              invoiceBalance -
                allocationAmount,
              0
            );

          const remainingCredit =
            Math.max(
              availableCredit -
                allocationAmount,
              0
            );

          const invoiceIsPaid =
            invoiceBalanceAfter <=
            0.001;

          // --------------------------------------------
          // IMPORTANT:
          //
          // Existing Payment represents the money.
          // Do not create another Payment.
          // Only create another allocation.
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
          // Update invoice status
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

          return {
            allocation,
            availableCredit,
            remainingCredit,
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
    // SUCCESS
    // --------------------------------------------------

    return NextResponse.json({
      success: true,

      message:
        result.remainingCredit >
        0.001
          ? `₹${allocationAmount.toFixed(
              2
            )} credit applied successfully. ₹${result.remainingCredit.toFixed(
              2
            )} credit remains available.`
          : "Customer credit applied successfully.",

      allocation: {
        id:
          result.allocation.id,

        amount:
          allocationAmount,

        availableCreditBefore:
          result.availableCredit,

        remainingCredit:
          result.remainingCredit,

        invoiceBalanceBefore:
          result.invoiceBalance,

        invoiceBalanceAfter:
          result.invoiceBalanceAfter,

        invoiceStatus:
          result.invoiceIsPaid
            ? "PAID"
            : "PARTIALLY_PAID",
      },
    });
  } catch (error) {
    console.error(
      "APPLY CUSTOMER CREDIT ERROR:",
      error
    );

    // --------------------------------------------------
    // Application validation errors
    // --------------------------------------------------

    if (
      error instanceof Error
    ) {
      switch (
        error.message
      ) {
        case "PAYMENT_NOT_FOUND":
          return NextResponse.json(
            {
              success: false,
              message:
                "Payment not found.",
            },
            {
              status: 404,
            }
          );

        case "PAYMENT_NO_CUSTOMER":
          return NextResponse.json(
            {
              success: false,
              message:
                "This payment is not linked to a customer.",
            },
            {
              status: 400,
            }
          );

        case "NO_AVAILABLE_CREDIT":
          return NextResponse.json(
            {
              success: false,
              message:
                "This payment has no available credit.",
            },
            {
              status: 400,
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

        case "CUSTOMER_MISMATCH":
          return NextResponse.json(
            {
              success: false,
              message:
                "Customer credit can only be applied to an invoice belonging to the same customer.",
            },
            {
              status: 400,
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

        case "CREDIT_EXCEEDED":
          return NextResponse.json(
            {
              success: false,
              message:
                "Allocation cannot exceed the available customer credit.",
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
                "Allocation cannot exceed the invoice balance.",
            },
            {
              status: 400,
            }
          );
      }
    }

    // --------------------------------------------------
    // Prisma transaction conflict / deadlock
    //
    // With Serializable isolation a simultaneous
    // competing transaction can intentionally fail.
    // Client can safely retry.
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
            "The payment or invoice was updated at the same time. Please try again.",

          code:
            "TRANSACTION_CONFLICT",
        },
        {
          status: 409,
        }
      );
    }

    // --------------------------------------------------
    // Duplicate payment/invoice allocation
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
            "This payment has already been applied to this invoice.",

          code:
            "DUPLICATE_ALLOCATION",
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
          "Unable to apply customer credit.",
      },
      {
        status: 500,
      }
    );
  }
}