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

    if (
      !canManageInvoices(
        membership.role
      )
    ) {
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

    // ----------------------------------------
    // Customer ID validation
    // ----------------------------------------

    if (
      typeof customerId !== "string" ||
      !customerId.trim()
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Customer is required.",
        },
        {
          status: 400,
        }
      );
    }

    // ----------------------------------------
    // Invoice number validation
    // ----------------------------------------

    if (
      typeof invoiceNumber !== "string" ||
      !invoiceNumber.trim()
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invoice number is required.",
        },
        {
          status: 400,
        }
      );
    }

    const normalizedInvoiceNumber =
      invoiceNumber.trim();

    // ----------------------------------------
    // Customer must belong to current workspace
    // ----------------------------------------

    const customer =
      await db.customer.findFirst({
        where: {
          id:
            customerId.trim(),

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
    // Amount validation
    // ----------------------------------------

    const amount =
      Number(totalAmount);

    if (
      totalAmount === undefined ||
      totalAmount === null ||
      totalAmount === "" ||
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
    // Due date validation
    // ----------------------------------------

    let parsedDueDate:
      | Date
      | null = null;

    if (
      dueDate !== undefined &&
      dueDate !== null &&
      dueDate !== ""
    ) {
      if (
        typeof dueDate !== "string"
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
    // Friendly duplicate check
    //
    // Database unique constraint remains the
    // final protection against race conditions.
    // ----------------------------------------

    const existingInvoice =
      await db.invoice.findFirst({
        where: {
          businessId:
            business.id,

          invoiceNumber:
            normalizedInvoiceNumber,
        },

        select: {
          id: true,
        },
      });

    if (existingInvoice) {
      return NextResponse.json(
        {
          success: false,
          message:
            "An invoice with this invoice number already exists.",
          code:
            "DUPLICATE_INVOICE_NUMBER",
        },
        {
          status: 409,
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

          customerId:
            customer.id,

          invoiceNumber:
            normalizedInvoiceNumber,

          totalAmount:
            amount,

          dueDate:
            parsedDueDate,

          notes:
            typeof notes === "string" &&
            notes.trim()
              ? notes.trim()
              : null,

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

    // ----------------------------------------
    // Prisma unique constraint protection
    //
    // Handles race condition where two requests
    // attempt the same invoice number together.
    // ----------------------------------------

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "An invoice with this invoice number already exists.",
          code:
            "DUPLICATE_INVOICE_NUMBER",
        },
        {
          status: 409,
        }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to create invoice.",
      },
      {
        status: 500,
      }
    );
  }
}