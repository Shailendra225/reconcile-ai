import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getCurrentMembership } from "@/lib/getCurrentMembership";
import { canManageReconciliation } from "@/lib/permissions";

export async function POST(request: Request) {
  try {
    const membership = await getCurrentMembership();

    if (!membership) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        { status: 401 }
      );
    }

    if (!canManageReconciliation(membership.role)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You do not have permission to manage reconciliation.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    const {
      bankTransactionId,
      invoiceId,
      confidenceScore,
      matchedAmount,
      reason,
    } = body;

    if (
      typeof bankTransactionId !== "string" ||
      !bankTransactionId.trim() ||
      typeof invoiceId !== "string" ||
      !invoiceId.trim() ||
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

    const numericConfidenceScore =
      Number(confidenceScore);

    if (
      !Number.isFinite(numericConfidenceScore) ||
      numericConfidenceScore < 0 ||
      numericConfidenceScore > 100
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "confidenceScore must be between 0 and 100.",
        },
        { status: 400 }
      );
    }

    let numericMatchedAmount: number | null = null;

    if (
      matchedAmount !== undefined &&
      matchedAmount !== null &&
      matchedAmount !== ""
    ) {
      numericMatchedAmount = Number(matchedAmount);

      if (
        !Number.isFinite(numericMatchedAmount) ||
        numericMatchedAmount <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "matchedAmount must be greater than 0.",
          },
          { status: 400 }
        );
      }
    }

    const bankTransaction =
      await db.bankTransaction.findFirst({
        where: {
          id: bankTransactionId.trim(),
          businessId: membership.businessId,
        },
        select: {
          id: true,
          direction: true,
        },
      });

    if (!bankTransaction) {
      return NextResponse.json(
        {
          success: false,
          message: "Bank transaction not found.",
        },
        { status: 404 }
      );
    }

    if (bankTransaction.direction !== "CREDIT") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Only CREDIT transactions can be reconciled.",
        },
        { status: 400 }
      );
    }

    const invoice = await db.invoice.findFirst({
      where: {
        id: invoiceId.trim(),
        businessId: membership.businessId,
      },
      select: {
        id: true,
      },
    });

    if (!invoice) {
      return NextResponse.json(
        {
          success: false,
          message: "Invoice not found.",
        },
        { status: 404 }
      );
    }

    const result = await db.$transaction(
      async (tx) => {
        const match =
          await tx.reconciliationMatch.create({
            data: {
              bankTransactionId:
                bankTransaction.id,
              invoiceId: invoice.id,
              confidenceScore:
                numericConfidenceScore,
              matchedAmount:
                numericMatchedAmount,
              reason:
                typeof reason === "string" &&
                reason.trim()
                  ? reason.trim()
                  : null,
              status: "SUGGESTED",
            },
          });

        await tx.bankTransaction.update({
          where: {
            id: bankTransaction.id,
          },
          data: {
            status: "SUGGESTED",
          },
        });

        return match;
      }
    );

    return NextResponse.json(
      {
        success: true,
        message:
          "Reconciliation match created successfully",
        match: result,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "RECONCILIATION ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to create reconciliation match",
      },
      { status: 500 }
    );
  }
}