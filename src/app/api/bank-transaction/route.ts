import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      businessId,
      transactionDate,
      description,
      reference,
      amount,
      direction,
      fingerprint,
    } = body;

    if (
      !businessId ||
      !transactionDate ||
      !description ||
      amount === undefined ||
      !direction ||
      !fingerprint
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "businessId, transactionDate, description, amount, direction and fingerprint are required",
        },
        { status: 400 }
      );
    }

    const transaction = await db.bankTransaction.create({
      data: {
        businessId,
        transactionDate: new Date(transactionDate),
        description,
        reference: reference || null,
        amount,
        direction,
        fingerprint,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Bank transaction created successfully",
        transaction,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("CREATE BANK TRANSACTION ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create bank transaction",
      },
      { status: 500 }
    );
  }
}