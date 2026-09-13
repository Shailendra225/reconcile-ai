import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { name, email, phone } = body;

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          message: "Business name is required",
        },
        { status: 400 }
      );
    }

    const business = await db.business.create({
      data: {
        name,
        email: email || null,
        phone: phone || null,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Business created successfully",
        business,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("CREATE BUSINESS ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create business",
      },
      { status: 500 }
    );
  }
}