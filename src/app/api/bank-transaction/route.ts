import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getCurrentMembership } from "@/lib/getCurrentMembership";
import { canManageTransactions } from "@/lib/permissions";
import { getPlanLimits } from "@/lib/plans";

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
    // ----------------------------------------

    if (
      !canManageTransactions(
        membership.role
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You do not have permission to create bank transactions.",
        },
        {
          status: 403,
        }
      );
    }

    const body =
      await request.json();

    const {
      transactionDate,
      description,
      reference,
      amount,
      direction,
      fingerprint,
    } = body;

    // ----------------------------------------
    // Required fields
    // ----------------------------------------

    if (
      !transactionDate ||
      typeof description !== "string" ||
      !description.trim() ||
      amount === undefined ||
      !direction ||
      typeof fingerprint !== "string" ||
      !fingerprint.trim()
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "transactionDate, description, amount, direction and fingerprint are required.",
        },
        {
          status: 400,
        }
      );
    }

    // ----------------------------------------
    // Amount validation
    // ----------------------------------------

    const numericAmount =
      Number(amount);

    if (
      !Number.isFinite(
        numericAmount
      ) ||
      numericAmount <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Amount must be greater than 0.",
        },
        {
          status: 400,
        }
      );
    }

    // ----------------------------------------
    // Direction validation
    // ----------------------------------------

    if (
      direction !== "CREDIT" &&
      direction !== "DEBIT"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Direction must be CREDIT or DEBIT.",
        },
        {
          status: 400,
        }
      );
    }

    // ----------------------------------------
    // Date validation
    // ----------------------------------------

    const parsedTransactionDate =
      new Date(transactionDate);

    if (
      Number.isNaN(
        parsedTransactionDate.getTime()
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid transaction date.",
        },
        {
          status: 400,
        }
      );
    }

    const normalizedFingerprint =
      fingerprint.trim();

    // ----------------------------------------
    // Duplicate protection
    // ----------------------------------------

    const existingTransaction =
      await db.bankTransaction.findFirst({
        where: {
          businessId:
            membership.businessId,

          fingerprint:
            normalizedFingerprint,
        },

        select: {
          id: true,
        },
      });

    if (existingTransaction) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This bank transaction already exists.",
        },
        {
          status: 409,
        }
      );
    }

    // ----------------------------------------
    // Subscription
    // ----------------------------------------

    const subscription =
      await db.subscription.findUnique({
        where: {
          businessId:
            membership.businessId,
        },
      });

    if (!subscription) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Business subscription could not be found.",
        },
        {
          status: 409,
        }
      );
    }

    if (
      subscription.status !== "ACTIVE"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Your subscription is not active.",
        },
        {
          status: 403,
        }
      );
    }

    const limits =
      getPlanLimits(
        subscription.plan
      );

    // ----------------------------------------
    // Current billing-month usage
    //
    // Usage is based on when the transaction
    // was added to Reconcile AI (createdAt),
    // not the bank transaction date.
    // ----------------------------------------

    const now = new Date();

    const monthStart =
      new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          1
        )
      );

    const nextMonthStart =
      new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth() + 1,
          1
        )
      );

    const monthlyUsage =
      await db.bankTransaction.count({
        where: {
          businessId:
            membership.businessId,

          createdAt: {
            gte:
              monthStart,

            lt:
              nextMonthStart,
          },
        },
      });

    // ----------------------------------------
    // Monthly transaction limit
    // ----------------------------------------

    if (
      monthlyUsage >=
      limits.monthlyTransactions
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            `Your ${subscription.plan} plan allows ${limits.monthlyTransactions} transactions per month. You have reached your monthly transaction limit.`,

          plan:
            subscription.plan,

          monthlyLimit:
            limits.monthlyTransactions,

          used:
            monthlyUsage,

          remaining: 0,
        },
        {
          status: 403,
        }
      );
    }

    // ----------------------------------------
    // Create transaction
    // ----------------------------------------

    const transaction =
      await db.bankTransaction.create({
        data: {
          businessId:
            membership.businessId,

          transactionDate:
            parsedTransactionDate,

          description:
            description.trim(),

          reference:
            typeof reference === "string" &&
            reference.trim()
              ? reference.trim()
              : null,

          amount:
            numericAmount,

          direction,

          status:
            "UNMATCHED",

          fingerprint:
            normalizedFingerprint,
        },
      });

    const usedAfterCreate =
      monthlyUsage + 1;

    return NextResponse.json(
      {
        success: true,

        message:
          "Bank transaction created successfully.",

        transaction,

        usage: {
          plan:
            subscription.plan,

          monthlyLimit:
            limits.monthlyTransactions,

          used:
            usedAfterCreate,

          remaining:
            Math.max(
              limits.monthlyTransactions -
                usedAfterCreate,
              0
            ),
        },
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "CREATE BANK TRANSACTION ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to create bank transaction.",
      },
      {
        status: 500,
      }
    );
  }
}