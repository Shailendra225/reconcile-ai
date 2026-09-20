import { NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import { createHash } from "crypto";

import { runReconciliation } from "@/lib/runReconciliation";
import { getCurrentMembership } from "@/lib/getCurrentMembership";
import { canManageTransactions } from "@/lib/permissions";
import { getPlanLimits } from "@/lib/plans";
import { db } from "@/lib/db";

type CsvRow = {
  date?: string;
  description?: string;
  reference?: string;
  amount?: string;
  direction?: string;
};

type PreparedTransaction = {
  transactionDate: Date;
  description: string;
  reference: string | null;
  amount: number;
  direction: "CREDIT" | "DEBIT";
  fingerprint: string;
};

export async function POST(
  request: Request
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
            "You do not have permission to import transactions.",
        },
        {
          status: 403,
        }
      );
    }

    const business =
      membership.business;

    // ----------------------------------------
    // Subscription
    // ----------------------------------------

    const subscription =
      await db.subscription.findUnique({
        where: {
          businessId:
            business.id,
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
    // Current monthly usage
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
            business.id,

          createdAt: {
            gte: monthStart,
            lt: nextMonthStart,
          },
        },
      });

    // ----------------------------------------
    // Read uploaded CSV
    // ----------------------------------------

    const formData =
      await request.formData();

    const file =
      formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "CSV file is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !file.name
        .toLowerCase()
        .endsWith(".csv")
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Only CSV files are allowed.",
        },
        {
          status: 400,
        }
      );
    }

    const csvText =
      await file.text();

    const rows = parse(
      csvText,
      {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
      }
    ) as CsvRow[];

    if (rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "CSV file contains no transactions.",
        },
        {
          status: 400,
        }
      );
    }

    let duplicates = 0;
    let invalid = 0;

    const preparedTransactions:
      PreparedTransaction[] = [];

    const seenFingerprints =
      new Set<string>();

    // ----------------------------------------
    // Validate + prepare CSV rows
    // ----------------------------------------

    for (const row of rows) {
      const date =
        row.date?.trim();

      const description =
        row.description?.trim();

      const reference =
        row.reference?.trim() ||
        null;

      const amount =
        Number(
          row.amount
            ?.replace(/,/g, "")
            .trim()
        );

      const direction =
        row.direction
          ?.trim()
          .toUpperCase();

      if (
        !date ||
        !description ||
        !Number.isFinite(
          amount
        ) ||
        amount <= 0 ||
        (
          direction !==
            "CREDIT" &&
          direction !==
            "DEBIT"
        )
      ) {
        invalid++;
        continue;
      }

      const transactionDate =
        new Date(
          `${date}T00:00:00.000Z`
        );

      if (
        Number.isNaN(
          transactionDate.getTime()
        )
      ) {
        invalid++;
        continue;
      }

      const fingerprint =
        createHash("sha256")
          .update(
            [
              business.id,
              date,
              description.toLowerCase(),
              reference ?? "",
              amount.toFixed(2),
              direction,
            ].join("|")
          )
          .digest("hex");

      // --------------------------------------
      // Duplicate inside same uploaded CSV
      // --------------------------------------

      if (
        seenFingerprints.has(
          fingerprint
        )
      ) {
        duplicates++;
        continue;
      }

      seenFingerprints.add(
        fingerprint
      );

      // --------------------------------------
      // Duplicate already in database
      // --------------------------------------

      const existing =
        await db.bankTransaction.findFirst({
          where: {
            businessId:
              business.id,

            fingerprint,
          },

          select: {
            id: true,
          },
        });

      if (existing) {
        duplicates++;
        continue;
      }

      preparedTransactions.push({
        transactionDate,

        description,

        reference,

        amount,

        direction:
          direction === "CREDIT"
            ? "CREDIT"
            : "DEBIT",

        fingerprint,
      });
    }

    // ----------------------------------------
    // Monthly plan limit
    // ----------------------------------------

    const remainingTransactions =
      Math.max(
        limits.monthlyTransactions -
          monthlyUsage,
        0
      );

    if (
      preparedTransactions.length >
      remainingTransactions
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            `Your ${subscription.plan} plan allows ${limits.monthlyTransactions} transactions per month. You have ${remainingTransactions} transaction${
              remainingTransactions === 1
                ? ""
                : "s"
            } remaining this month.`,

          plan:
            subscription.plan,

          monthlyLimit:
            limits.monthlyTransactions,

          used:
            monthlyUsage,

          remaining:
            remainingTransactions,

          attemptedImport:
            preparedTransactions.length,

          duplicates,

          invalid,

          imported: 0,
        },
        {
          status: 403,
        }
      );
    }

    // ----------------------------------------
    // Import prepared transactions
    // ----------------------------------------

// ----------------------------------------
// Import prepared transactions
// ----------------------------------------

let imported = 0;

if (
  preparedTransactions.length > 0
) {
  const result =
    await db.bankTransaction.createMany({
      data:
        preparedTransactions.map(
          (transaction) => ({
            businessId:
              business.id,

            transactionDate:
              transaction.transactionDate,

            description:
              transaction.description,

            reference:
              transaction.reference,

            amount:
              transaction.amount,

            direction:
              transaction.direction,

            status:
              "UNMATCHED",

            fingerprint:
              transaction.fingerprint,
          })
        ),

      skipDuplicates: true,
    });

  imported =
    result.count;
}

    // ----------------------------------------
    // Run reconciliation
    // ----------------------------------------

    const reconciliation =
      imported > 0
        ? await runReconciliation(
            business.id
          )
        : null;

    return NextResponse.json({
      success: true,

      message:
        imported > 0
          ? "CSV import and reconciliation completed."
          : "No new transactions were imported.",

      imported,

      duplicates,

      invalid,

      totalRows:
        rows.length,

      usage: {
        plan:
          subscription.plan,

        monthlyLimit:
          limits.monthlyTransactions,

        usedBeforeImport:
          monthlyUsage,

        usedAfterImport:
          monthlyUsage +
          imported,

        remaining:
          Math.max(
            limits.monthlyTransactions -
              monthlyUsage -
              imported,
            0
          ),
      },

      reconciliation,
    });
  } catch (error) {
    console.error(
      "CSV IMPORT ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "Failed to import CSV file.",
      },
      {
        status: 500,
      }
    );
  }
}