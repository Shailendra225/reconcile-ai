import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getCurrentMembership } from "@/lib/getCurrentMembership";
import { canManageCustomers } from "@/lib/permissions";

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

    if (!canManageCustomers(membership.role)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You do not have permission to create customers.",
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
      name,
      email,
      phone,
      upiId,
      gstNumber,
    } = body;

    // ----------------------------------------
    // Validate customer name
    // ----------------------------------------

    if (
      !name ||
      typeof name !== "string" ||
      !name.trim()
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Customer name is required",
        },
        {
          status: 400,
        }
      );
    }

    // ----------------------------------------
    // Create customer in current workspace
    // ----------------------------------------

    const customer =
      await db.customer.create({
        data: {
          businessId:
            business.id,

          name:
            name.trim(),

          email:
            typeof email === "string" &&
            email.trim()
              ? email.trim()
              : null,

          phone:
            typeof phone === "string" &&
            phone.trim()
              ? phone.trim()
              : null,

          upiId:
            typeof upiId === "string" &&
            upiId.trim()
              ? upiId.trim()
              : null,

          gstNumber:
            typeof gstNumber === "string" &&
            gstNumber.trim()
              ? gstNumber.trim()
              : null,
        },
      });

    return NextResponse.json(
      {
        success: true,
        message:
          "Customer created successfully",
        customer,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "CREATE CUSTOMER ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to create customer",
      },
      {
        status: 500,
      }
    );
  }
}