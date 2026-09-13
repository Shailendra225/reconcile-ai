import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      bankTransactionId,
      invoiceId,
      confidenceScore,
      matchedAmount,
      reason,
    } = body;

    if (
      !bankTransactionId ||
      !invoiceId ||
      confidenceScore === undefined
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "bankTransactionId, invoiceId and confidenceScore are required",
        },
        { status: 400 }
      );
    }

    const match = await db.reconciliationMatch.create({
      data: {
        bankTransactionId,
        invoiceId,
        confidenceScore,
        matchedAmount: matchedAmount ?? null,
        reason: reason || null,
        status: "SUGGESTED",
      },
    });

    await db.bankTransaction.update({
      where: {
        id: bankTransactionId,
      },
      data: {
        status: "SUGGESTED",
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Reconciliation match created successfully",
        match,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("RECONCILIATION ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create reconciliation match",
      },
      { status: 500 }
    );
  }
}