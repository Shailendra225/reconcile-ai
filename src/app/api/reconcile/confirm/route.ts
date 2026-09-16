import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getCurrentMembership } from "@/lib/getCurrentMembership";
import { canManageReconciliation } from "@/lib/permissions";

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
      !canManageReconciliation(
        membership.role
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You do not have permission to confirm reconciliation.",
        },
        {
          status: 403,
        }
      );
    }

    const businessId =
      membership.businessId;

    // ----------------------------------------
    // Request body
    // ----------------------------------------

    const body =
      await request.json();

    const { matchId } = body;

    if (
      !matchId ||
      typeof matchId !== "string"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "matchId is required",
        },
        {
          status: 400,
        }
      );
    }

    // ----------------------------------------
    // Confirm reconciliation
    // ----------------------------------------

    const result =
      await db.$transaction(
        async (tx) => {
          const match =
            await tx.reconciliationMatch.findFirst({
              where: {
                id: matchId,

                // Important:
                // Match must belong to
                // logged-in user's business
                invoice: {
                  businessId,
                },

                bankTransaction: {
                  businessId,
                },
              },

              include: {
                bankTransaction: true,
                invoice: true,
              },
            });

          if (!match) {
            throw new Error(
              "Reconciliation match not found."
            );
          }

          if (
            match.status ===
            "CONFIRMED"
          ) {
            throw new Error(
              "This match is already confirmed."
            );
          }

          const transaction =
            match.bankTransaction;

          const invoice =
            match.invoice;

          // Extra workspace safety
          if (
            transaction.businessId !==
              businessId ||
            invoice.businessId !==
              businessId
          ) {
            throw new Error(
              "Reconciliation match does not belong to this business."
            );
          }

          if (
            transaction.direction !==
            "CREDIT"
          ) {
            throw new Error(
              "Only credit transactions can be reconciled."
            );
          }

          // ----------------------------------
          // Find/create payment
          // ----------------------------------

          let payment =
            await tx.payment.findUnique({
              where: {
                bankTransactionId:
                  transaction.id,
              },
            });

          if (!payment) {
            payment =
              await tx.payment.create({
                data: {
                  businessId,

                  customerId:
                    invoice.customerId,

                  bankTransactionId:
                    transaction.id,

                  amount:
                    transaction.amount,

                  paymentDate:
                    transaction.transactionDate,

                  reference:
                    transaction.reference,

                  source:
                    "BANK_TRANSFER",
                },
              });
          } else if (
            payment.businessId !==
            businessId
          ) {
            throw new Error(
              "Payment does not belong to this business."
            );
          }

          // ----------------------------------
          // Payment allocation
          // ----------------------------------

          const allocationAmount =
            match.matchedAmount ??
            transaction.amount;

          await tx.paymentAllocation.upsert({
            where: {
              paymentId_invoiceId: {
                paymentId:
                  payment.id,

                invoiceId:
                  invoice.id,
              },
            },

            update: {
              amount:
                allocationAmount,
            },

            create: {
              paymentId:
                payment.id,

              invoiceId:
                invoice.id,

              amount:
                allocationAmount,
            },
          });

          // ----------------------------------
          // Confirm match
          // ----------------------------------

          await tx.reconciliationMatch.update({
            where: {
              id: match.id,
            },

            data: {
              status:
                "CONFIRMED",
            },
          });

          // ----------------------------------
          // Mark bank transaction matched
          // ----------------------------------

          await tx.bankTransaction.update({
            where: {
              id: transaction.id,
            },

            data: {
              status:
                "MATCHED",
            },
          });

          // ----------------------------------
          // Calculate invoice paid amount
          // ----------------------------------

          const allocations =
            await tx.paymentAllocation.aggregate({
              where: {
                invoiceId:
                  invoice.id,
              },

              _sum: {
                amount: true,
              },
            });

          const totalPaid =
            allocations._sum.amount ??
            0;

          const newInvoiceStatus =
            Number(totalPaid) >=
            Number(
              invoice.totalAmount
            )
              ? "PAID"
              : Number(totalPaid) >
                  0
                ? "PARTIALLY_PAID"
                : invoice.status;

          // ----------------------------------
          // Update invoice
          // ----------------------------------

          await tx.invoice.update({
            where: {
              id: invoice.id,
            },

            data: {
              status:
                newInvoiceStatus,
            },
          });

          return {
            payment,
            invoiceStatus:
              newInvoiceStatus,
            totalPaid,
          };
        }
      );

    return NextResponse.json({
      success: true,

      message:
        "Payment reconciliation confirmed successfully",

      result,
    });
  } catch (error) {
    console.error(
      "CONFIRM RECONCILIATION ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "Failed to confirm reconciliation",
      },
      {
        status: 500,
      }
    );
  }
}