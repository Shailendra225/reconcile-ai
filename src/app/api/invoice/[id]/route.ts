import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/getCurrentBusiness";
import { getCurrentMembership } from "@/lib/getCurrentMembership";
import { canManageInvoices } from "@/lib/permissions";

// ======================================================
// GET INVOICE
// All workspace members can view
// ======================================================

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

// ======================================================
// UPDATE INVOICE
// OWNER / ADMIN / ACCOUNTANT only
// VIEWER blocked
// ======================================================

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    // ----------------------------------------
    // Authentication + workspace membership
    // ----------------------------------------

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

    // ----------------------------------------
    // Invoice permission
    // ----------------------------------------

    if (
      !canManageInvoices(
        membership.role
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You do not have permission to update invoices.",
        },
        {
          status: 403,
        }
      );
    }

    const businessId =
      membership.businessId;

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

    // ----------------------------------------
    // Validation
    // ----------------------------------------

    if (
      typeof invoiceNumber !==
        "string" ||
      !invoiceNumber.trim() ||
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

    // ----------------------------------------
    // Invoice must belong to current workspace
    // ----------------------------------------

    const existingInvoice =
      await db.invoice.findFirst({
        where: {
          id,
          businessId,
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

    // ----------------------------------------
    // Due date validation
    // ----------------------------------------

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

    // ----------------------------------------
    // Update invoice
    // ----------------------------------------

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
            typeof notes ===
              "string" &&
            notes.trim()
              ? notes.trim()
              : null,
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