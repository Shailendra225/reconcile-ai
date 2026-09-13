import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const businessCount = await db.business.count();

    return NextResponse.json({
      success: true,
      message: "Database connected successfully",
      businessCount,
    });
  } catch (error) {
    console.error("DB TEST ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Database connection failed",
      },
      { status: 500 }
    );
  }
}