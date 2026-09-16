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

    const body =
      await request.json();

    const paymentId = String(
      body.paymentId ?? ""
    ).trim();

    const invoiceId = String(
      body.invoiceId ?? ""
    ).trim();

    const allocationAmount = Number(
      body.allocationAmount
    );

    if (!paymentId || !invoiceId) {
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
      !Number.isFinite(allocationAmount) ||
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
    // Find payment belonging to current workspace
    // --------------------------------------------------

    const payment =
      await db.payment.findFirst({
        where: {
          id: paymentId,
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
      return NextResponse.json(
        {
          success: false,
          message: "Payment not found.",
        },
        {
          status: 404,
        }
      );
    }

    // --------------------------------------------------
    // Payment must belong to a customer
    // --------------------------------------------------

    if (!payment.customerId) {
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
    }

    // --------------------------------------------------
    // Calculate available customer credit
    // --------------------------------------------------

    const paymentAmount =
      Number(payment.amount);

    const alreadyAllocated =
      payment.allocations.reduce(
        (sum, allocation) =>
          sum + Number(allocation.amount),
        0
      );

    const availableCredit =
      Math.max(
        paymentAmount -
          alreadyAllocated,
        0
      );

    if (availableCredit <= 0.001) {
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
    }

    // --------------------------------------------------
    // Find open invoice belonging to current workspace
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
    // SECURITY / ACCOUNTING RULE
    //
    // Customer credit can only be used for an invoice
    // belonging to the SAME customer.
    // --------------------------------------------------

    if (
      invoice.customerId !==
      payment.customerId
    ) {
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
    }

    // --------------------------------------------------
    // Calculate invoice balance
    // --------------------------------------------------

    const invoiceTotal =
      Number(invoice.totalAmount);

    const invoiceAlreadyPaid =
      invoice.allocations.reduce(
        (sum, allocation) =>
          sum + Number(allocation.amount),
        0
      );

    const invoiceBalance =
      Math.max(
        invoiceTotal -
          invoiceAlreadyPaid,
        0
      );

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
    // Validate allocation amount
    // --------------------------------------------------

    if (
      allocationAmount >
      availableCredit + 0.001
    ) {
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
    }

    if (
      allocationAmount >
      invoiceBalance + 0.001
    ) {
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

    // --------------------------------------------------
    // Calculate balances after allocation
    // --------------------------------------------------

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
      invoiceBalanceAfter <= 0.001;

    // --------------------------------------------------
    // Apply existing payment credit
    // --------------------------------------------------

    const allocation =
      await db.$transaction(
        async (tx) => {
          /*
           * IMPORTANT:
           *
           * Do NOT create a new Payment here.
           *
           * Money already exists in the
           * original Payment.
           *
           * We only create another
           * PaymentAllocation.
           */

          const newAllocation =
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

          return newAllocation;
        }
      );

    // --------------------------------------------------
    // Success response
    // --------------------------------------------------

    return NextResponse.json({
      success: true,

      message:
        remainingCredit > 0.001
          ? `₹${allocationAmount.toFixed(
              2
            )} credit applied successfully. ₹${remainingCredit.toFixed(
              2
            )} credit remains available.`
          : "Customer credit applied successfully.",

      allocation: {
        id: allocation.id,

        amount:
          allocationAmount,

        availableCreditBefore:
          availableCredit,

        remainingCredit,

        invoiceBalanceBefore:
          invoiceBalance,

        invoiceBalanceAfter,

        invoiceStatus:
          invoiceIsPaid
            ? "PAID"
            : "PARTIALLY_PAID",
      },
    });
  } catch (error) {
    console.error(
      "APPLY CUSTOMER CREDIT ERROR:",
      error
    );

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