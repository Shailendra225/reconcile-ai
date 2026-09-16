import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getCurrentMembership } from "@/lib/getCurrentMembership";
import { canManageBusiness } from "@/lib/permissions";

export async function PUT(request: Request) {
  try {
    // ----------------------------------------
    // AUTHENTICATION + WORKSPACE MEMBERSHIP
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
    // ROLE PERMISSION
    //
    // OWNER / ADMIN = allowed
    // ACCOUNTANT / VIEWER = blocked
    // ----------------------------------------

    if (
      !canManageBusiness(
        membership.role
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You do not have permission to update business settings.",
        },
        {
          status: 403,
        }
      );
    }

    const businessId =
      membership.businessId;

    const body =
      await request.json();

    const {
      name,
      email,
      phone,
      currency,
      address,
      city,
      state,
      pincode,
      gstin,
    } = body;

    // ----------------------------------------
    // Business name validation
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
            "Business name is required.",
        },
        {
          status: 400,
        }
      );
    }

    // ----------------------------------------
    // Currency validation
    // ----------------------------------------

    const allowedCurrencies = [
      "INR",
      "USD",
      "EUR",
      "GBP",
    ];

    if (
      typeof currency !== "string" ||
      !allowedCurrencies.includes(
        currency
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid currency.",
        },
        {
          status: 400,
        }
      );
    }

    // ----------------------------------------
    // Email validation
    // ----------------------------------------

    if (
      email !== undefined &&
      email !== null &&
      email !== ""
    ) {
      if (typeof email !== "string") {
        return NextResponse.json(
          {
            success: false,
            message:
              "Please enter a valid business email.",
          },
          {
            status: 400,
          }
        );
      }

      const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (
        !emailRegex.test(
          email.trim()
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Please enter a valid business email.",
          },
          {
            status: 400,
          }
        );
      }
    }

    // ----------------------------------------
    // Pincode validation
    // ----------------------------------------

    if (
      pincode !== undefined &&
      pincode !== null &&
      pincode !== ""
    ) {
      const pincodeRegex =
        /^[1-9][0-9]{5}$/;

      if (
        typeof pincode !== "string" ||
        !pincodeRegex.test(
          pincode.trim()
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Please enter a valid 6-digit Indian pincode.",
          },
          {
            status: 400,
          }
        );
      }
    }

    // ----------------------------------------
    // GSTIN validation
    // ----------------------------------------

    if (
      gstin !== undefined &&
      gstin !== null &&
      gstin !== ""
    ) {
      if (typeof gstin !== "string") {
        return NextResponse.json(
          {
            success: false,
            message:
              "Please enter a valid 15-character GSTIN.",
          },
          {
            status: 400,
          }
        );
      }

      const normalizedGstin =
        gstin
          .trim()
          .toUpperCase();

      const gstinRegex =
        /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

      if (
        !gstinRegex.test(
          normalizedGstin
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Please enter a valid 15-character GSTIN.",
          },
          {
            status: 400,
          }
        );
      }
    }

    // ----------------------------------------
    // UPDATE CURRENT WORKSPACE BUSINESS
    // ----------------------------------------

    const updatedBusiness =
      await db.business.update({
        where: {
          id: businessId,
        },

        data: {
          name:
            name.trim(),

          email:
            typeof email === "string" &&
            email.trim()
              ? email
                  .trim()
                  .toLowerCase()
              : null,

          phone:
            typeof phone === "string" &&
            phone.trim()
              ? phone.trim()
              : null,

          currency,

          address:
            typeof address === "string" &&
            address.trim()
              ? address.trim()
              : null,

          city:
            typeof city === "string" &&
            city.trim()
              ? city.trim()
              : null,

          state:
            typeof state === "string" &&
            state.trim()
              ? state.trim()
              : null,

          pincode:
            typeof pincode === "string" &&
            pincode.trim()
              ? pincode.trim()
              : null,

          gstin:
            typeof gstin === "string" &&
            gstin.trim()
              ? gstin
                  .trim()
                  .toUpperCase()
              : null,
        },

        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          currency: true,
          address: true,
          city: true,
          state: true,
          pincode: true,
          gstin: true,
          updatedAt: true,
        },
      });

    return NextResponse.json({
      success: true,

      message:
        "Business settings updated successfully.",

      business:
        updatedBusiness,
    });
  } catch (error) {
    console.error(
      "BUSINESS SETTINGS UPDATE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to update business settings.",
      },
      {
        status: 500,
      }
    );
  }
}