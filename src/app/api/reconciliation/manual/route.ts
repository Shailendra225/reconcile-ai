import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/getCurrentBusiness";

export async function POST(request: Request) {
  try {
    const business = await getCurrentBusiness();

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

    const body = await request.json();

    const transactionId =
      String(body.transactionId ?? "").trim();

    const invoiceId =
      String(body.invoiceId ?? "").trim();

    const allocationAmount =
      Number(body.allocationAmount);

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

    // Make sure the transaction belongs
    // to the logged-in business.
    const bankTransaction =
      await db.bankTransaction.findFirst({
        where: {
          id: transactionId,
          businessId: business.id,
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

    // Make sure the invoice also belongs
    // to the logged-in business.
    const invoice =
      await db.invoice.findFirst({
        where: {
          id: invoiceId,
          businessId: business.id,
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

    const invoiceTotal =
      Number(invoice.totalAmount);

    const alreadyPaid =
      invoice.allocations.reduce(
        (sum, allocation) =>
          sum + Number(allocation.amount),
        0
      );

    const invoiceBalance =
      Math.max(
        invoiceTotal - alreadyPaid,
        0
      );

    const transactionAmount =
      Number(bankTransaction.amount);

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

    const newPaidAmount =
      alreadyPaid + allocationAmount;

    const invoiceIsPaid =
      newPaidAmount >= invoiceTotal - 0.001;

    await db.$transaction(async (tx) => {
      // Create payment for the bank transaction.
      const payment =
        await tx.payment.create({
          data: {
            businessId: business.id,
            bankTransactionId:
              bankTransaction.id,
            amount: allocationAmount,
            paymentDate:
              bankTransaction.transactionDate,
            source: "BANK_TRANSFER",
          },
        });

      // Allocate payment to selected invoice.
      await tx.paymentAllocation.create({
        data: {
          paymentId: payment.id,
          invoiceId: invoice.id,
          amount: allocationAmount,
        },
      });

      // Update invoice status.
      await tx.invoice.update({
        where: {
          id: invoice.id,
        },
        data: {
          status: invoiceIsPaid
            ? "PAID"
            : "PARTIALLY_PAID",
        },
      });

      // For this first manual-match version,
      // the complete bank transaction must be allocated.
      await tx.bankTransaction.update({
        where: {
          id: bankTransaction.id,
        },
        data: {
          status: "MATCHED",
        },
      });
    });

    return NextResponse.json({
      success: true,
      message:
        "Transaction manually matched successfully.",
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
