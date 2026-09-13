import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/getCurrentBusiness";

export async function GET(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
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

    const { id } =
      await context.params;

    const invoice =
      await db.invoice.findFirst({
        where: {
          id,
          businessId:
            business.id,
        },

        include: {
          customer: true,

          items: true,

          allocations: {
            include: {
              payment: {
                include: {
                  bankTransaction:
                    true,
                },
              },
            },
          },

          matches: {
            include: {
              bankTransaction:
                true,
            },
          },
        },
      });

    if (!invoice) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invoice not found",
        },
        {
          status: 404,
        }
      );
    }

    const totalPaid =
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

    const balanceDue =
      Math.max(
        Number(
          invoice.totalAmount
        ) - totalPaid,
        0
      );

    return NextResponse.json({
      success: true,

      invoice: {
        ...invoice,
        totalPaid,
        balanceDue,
      },
    });
  } catch (error) {
    console.error(
      "GET INVOICE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch invoice",
      },
      {
        status: 500,
      }
    );
  }
}

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
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

    const { id } =
      await context.params;

    const body =
      await request.json();

    const {
      invoiceNumber,
      totalAmount,
      dueDate,
      notes,
    } = body;

    if (
      !invoiceNumber ||
      totalAmount === undefined
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invoice number and amount are required",
        },
        {
          status: 400,
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
            "Amount must be a valid positive number.",
        },
        {
          status: 400,
        }
      );
    }

    const existingInvoice =
      await db.invoice.findFirst({
        where: {
          id,
          businessId:
            business.id,
        },

        select: {
          id: true,
        },
      });

    if (!existingInvoice) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invoice not found",
        },
        {
          status: 404,
        }
      );
    }

    let parsedDueDate:
      | Date
      | null = null;

    if (dueDate) {
      parsedDueDate =
        new Date(dueDate);

      if (
        Number.isNaN(
          parsedDueDate.getTime()
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Invalid due date.",
          },
          {
            status: 400,
          }
        );
      }
    }

    const invoice =
      await db.invoice.update({
        where: {
          id:
            existingInvoice.id,
        },

        data: {
          invoiceNumber:
            invoiceNumber.trim(),

          totalAmount:
            amount,

          dueDate:
            parsedDueDate,

          notes:
            notes?.trim() ||
            null,
        },
      });

    return NextResponse.json({
      success: true,
      message:
        "Invoice updated successfully",
      invoice,
    });
  } catch (error) {
    console.error(
      "UPDATE INVOICE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to update invoice",
      },
      {
        status: 500,
      }
    );
  }
}