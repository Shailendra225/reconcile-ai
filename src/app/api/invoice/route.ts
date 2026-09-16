import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getCurrentMembership } from "@/lib/getCurrentMembership";
import { canManageInvoices } from "@/lib/permissions";

export async function POST(request: Request) {
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
    // Role permission
    // OWNER / ADMIN / ACCOUNTANT = allowed
    // VIEWER = blocked
    // ----------------------------------------

    if (!canManageInvoices(membership.role)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You do not have permission to create invoices.",
        },
        {
          status: 403,
        }
      );
    }

    const business =
      membership.business;

    // ----------------------------------------
    // Request body
    // ----------------------------------------

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

    // ----------------------------------------
    // Customer must belong to current workspace
    // ----------------------------------------

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

    // ----------------------------------------
    // Validate amount
    // ----------------------------------------

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

    // ----------------------------------------
    // Create invoice
    // ----------------------------------------

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