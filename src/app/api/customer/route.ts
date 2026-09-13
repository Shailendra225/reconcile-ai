import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/getCurrentBusiness";

export async function POST(request: Request) {
  try {
    // Get logged-in user's business
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
      name,
      email,
      phone,
      upiId,
      gstNumber,
    } = body;

    // Customer name is required
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

    const customer =
      await db.customer.create({
        data: {
          businessId:
            business.id,

          name:
            name.trim(),

          email:
            email?.trim() ||
            null,

          phone:
            phone?.trim() ||
            null,

          upiId:
            upiId?.trim() ||
            null,

          gstNumber:
            gstNumber?.trim() ||
            null,
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