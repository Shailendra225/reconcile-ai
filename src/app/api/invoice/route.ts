import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/getCurrentBusiness";

export async function POST(request: Request) {
  try {
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

    const body =
      await request.json();

    const {
      customerId,
      invoiceNumber,
      totalAmount,
      dueDate,
      notes,
    } = body;

    if (
      !customerId ||
      !invoiceNumber ||
      totalAmount === undefined
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "customerId, invoiceNumber and totalAmount are required",
        },
        {
          status: 400,
        }
      );
    }

    // Make sure the selected customer
    // belongs to the logged-in business.
    const customer =
      await db.customer.findFirst({
        where: {
          id: customerId,
          businessId:
            business.id,
        },
        select: {
          id: true,
        },
      });

    if (!customer) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Customer not found.",
        },
        {
          status: 404,
        }
      );
    }

    const amount =
      Number(totalAmount);

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "totalAmount must be a valid positive number.",
        },
        {
          status: 400,
        }
      );
    }

    const invoice =
      await db.invoice.create({
        data: {
          businessId:
            business.id,

          customerId,

          invoiceNumber,

          totalAmount:
            amount,

          dueDate:
            dueDate
              ? new Date(dueDate)
              : null,

          notes:
            notes || null,

          status:
            "SENT",
        },
      });

    return NextResponse.json(
      {
        success: true,
        message:
          "Invoice created successfully",
        invoice,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "CREATE INVOICE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to create invoice",
      },
      {
        status: 500,
      }
    );
  }
}