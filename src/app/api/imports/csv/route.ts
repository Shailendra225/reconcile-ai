import { NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import { createHash } from "crypto";

import { runReconciliation } from "@/lib/runReconciliation";
import { getCurrentBusiness } from "@/lib/getCurrentBusiness";
import { db } from "@/lib/db";

type CsvRow = {
  date?: string;
  description?: string;
  reference?: string;
  amount?: string;
  direction?: string;
};

export async function POST(
  request: Request
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

    let imported = 0;
    let duplicates = 0;
    let invalid = 0;

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

      await db.bankTransaction.create({
        data: {
          businessId:
            business.id,

          transactionDate,

          description,

          reference,

          amount,

          direction:
            direction ===
            "CREDIT"
              ? "CREDIT"
              : "DEBIT",

          status:
            "UNMATCHED",

          fingerprint,
        },
      });

      imported++;
    }

    const reconciliation =
      await runReconciliation(
        business.id
      );

    return NextResponse.json({
      success: true,

      message:
        "CSV import and reconciliation completed.",

      imported,

      duplicates,

      invalid,

      totalRows:
        rows.length,

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