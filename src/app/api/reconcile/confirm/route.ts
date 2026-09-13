import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { matchId } = body;

    if (!matchId) {
      return NextResponse.json(
        {
          success: false,
          message: "matchId is required",
        },
        { status: 400 }
      );
    }

    const result = await db.$transaction(async (tx) => {
      const match = await tx.reconciliationMatch.findUnique({
        where: {
          id: matchId,
        },
        include: {
          bankTransaction: true,
          invoice: true,
        },
      });

      if (!match) {
        throw new Error("Reconciliation match not found");
      }

      if (match.status === "CONFIRMED") {
        throw new Error("This match is already confirmed");
      }

      const transaction = match.bankTransaction;
      const invoice = match.invoice;

      if (transaction.direction !== "CREDIT") {
        throw new Error("Only credit transactions can be reconciled");
      }

      let payment = await tx.payment.findUnique({
        where: {
          bankTransactionId: transaction.id,
        },
      });

      if (!payment) {
        payment = await tx.payment.create({
          data: {
            businessId: invoice.businessId,
            customerId: invoice.customerId,
            bankTransactionId: transaction.id,
            amount: transaction.amount,
            paymentDate: transaction.transactionDate,
            reference: transaction.reference,
            source: "BANK_TRANSFER",
          },
        });
      }

      const allocationAmount =
        match.matchedAmount ?? transaction.amount;

      await tx.paymentAllocation.upsert({
        where: {
          paymentId_invoiceId: {
            paymentId: payment.id,
            invoiceId: invoice.id,
          },
        },
        update: {
          amount: allocationAmount,
        },
        create: {
          paymentId: payment.id,
          invoiceId: invoice.id,
          amount: allocationAmount,
        },
      });

      await tx.reconciliationMatch.update({
        where: {
          id: match.id,
        },
        data: {
          status: "CONFIRMED",
        },
      });

      await tx.bankTransaction.update({
        where: {
          id: transaction.id,
        },
        data: {
          status: "MATCHED",
        },
      });

      const allocations = await tx.paymentAllocation.aggregate({
        where: {
          invoiceId: invoice.id,
        },
        _sum: {
          amount: true,
        },
      });

      const totalPaid = allocations._sum.amount ?? 0;

      const newInvoiceStatus =
        Number(totalPaid) >= Number(invoice.totalAmount)
          ? "PAID"
          : Number(totalPaid) > 0
            ? "PARTIALLY_PAID"
            : invoice.status;

      await tx.invoice.update({
        where: {
          id: invoice.id,
        },
        data: {
          status: newInvoiceStatus,
        },
      });

      return {
        payment,
        invoiceStatus: newInvoiceStatus,
        totalPaid,
      };
    });

    return NextResponse.json({
      success: true,
      message: "Payment reconciliation confirmed successfully",
      result,
    });
  } catch (error) {
    console.error("CONFIRM RECONCILIATION ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to confirm reconciliation",
      },
      { status: 500 }
    );
  }
}