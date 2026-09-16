import { redirect } from "next/navigation";

import ManualMatchForm from "@/components/ManualMatchForm";
import ApplyCreditForm from "@/components/ApplyCreditForm";
import { db } from "@/lib/db";
import { getCurrentMembership } from "@/lib/getCurrentMembership";
import { canManageReconciliation } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function ManualReconciliationPage() {
  // --------------------------------------------------
  // Current workspace membership
  // --------------------------------------------------

  const membership =
    await getCurrentMembership();

  if (!membership) {
    redirect("/login");
  }

  const businessId =
    membership.businessId;

  const canManage =
    canManageReconciliation(
      membership.role
    );

  // --------------------------------------------------
  // Unmatched credit transactions
  // --------------------------------------------------

  const transactions =
    await db.bankTransaction.findMany({
      where: {
        businessId,
        direction: "CREDIT",
        status: "UNMATCHED",
      },

      orderBy: {
        transactionDate: "desc",
      },

      select: {
        id: true,
        amount: true,
        description: true,
        reference: true,
        transactionDate: true,
      },
    });

  // --------------------------------------------------
  // Open invoices
  // --------------------------------------------------

  const invoices =
    await db.invoice.findMany({
      where: {
        businessId,

        status: {
          in: [
            "SENT",
            "PARTIALLY_PAID",
            "OVERDUE",
          ],
        },
      },

      include: {
        customer: {
          select: {
            id: true,
            name: true,
          },
        },

        allocations: {
          select: {
            amount: true,
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });

  /*
   * Payments where:
   *
   * Payment.amount > total allocated amount
   *
   * are treated as unallocated customer credit.
   */

  const payments =
    await db.payment.findMany({
      where: {
        businessId,
      },

      include: {
        customer: {
          select: {
            id: true,
            name: true,
          },
        },

        bankTransaction: {
          select: {
            reference: true,
          },
        },

        allocations: {
          select: {
            amount: true,
          },
        },
      },

      orderBy: {
        paymentDate: "desc",
      },
    });

  // --------------------------------------------------
  // Calculate unallocated customer credits
  // --------------------------------------------------

  const unallocatedCredits =
    payments
      .map((payment) => {
        const paymentAmount =
          Number(payment.amount);

        const allocatedAmount =
          payment.allocations.reduce(
            (sum, allocation) =>
              sum +
              Number(
                allocation.amount
              ),
            0
          );

        const remainingCredit =
          Math.max(
            paymentAmount -
              allocatedAmount,
            0
          );

        return {
          id: payment.id,

          customerId:
            payment.customer?.id ??
            null,

          customerName:
            payment.customer?.name ??
            "Unknown customer",

          paymentAmount,

          allocatedAmount,

          remainingCredit,

          paymentDate:
            payment.paymentDate,

          reference:
            payment.reference ??
            payment.bankTransaction
              ?.reference ??
            null,
        };
      })
      .filter(
        (payment) =>
          payment.remainingCredit >
          0.001
      );

  // --------------------------------------------------
  // Transaction options for ManualMatchForm
  // --------------------------------------------------

  const transactionOptions =
    transactions.map(
      (transaction) => ({
        id: transaction.id,

        amount:
          Number(
            transaction.amount
          ),

        description:
          transaction.description,

        reference:
          transaction.reference,

        transactionDate:
          transaction.transactionDate.toISOString(),
      })
    );

  // --------------------------------------------------
  // Invoice options
  // --------------------------------------------------

  const invoiceOptions =
    invoices.map((invoice) => {
      const total =
        Number(
          invoice.totalAmount
        );

      const paid =
        invoice.allocations.reduce(
          (sum, allocation) =>
            sum +
            Number(
              allocation.amount
            ),
          0
        );

      const balance =
        Math.max(
          total - paid,
          0
        );

      return {
        id: invoice.id,

        invoiceNumber:
          invoice.invoiceNumber,

        customerId:
          invoice.customer.id,

        customerName:
          invoice.customer.name,

        balance,
      };
    });

  // --------------------------------------------------
  // Total unallocated credit
  // --------------------------------------------------

  const totalUnallocatedCredit =
    unallocatedCredits.reduce(
      (sum, payment) =>
        sum +
        payment.remainingCredit,
      0
    );

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <main className="min-h-screen bg-slate-950 px-8 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-medium text-cyan-400">
          Reconcile AI
        </p>

        <h1 className="mt-2 text-3xl font-bold">
          Manual Reconciliation
        </h1>

        <p className="mt-2 text-sm text-slate-400">
          Manually connect an unmatched bank
          transaction with an open invoice.
          Excess payment amounts remain
          available as customer credit.
        </p>

        {!canManage && (
          <div className="mt-6 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-400">
            You have read-only access to reconciliation data.
          </div>
        )}

        {/* Manual Match */}

        {canManage && (
          <div className="mt-8">
            <ManualMatchForm
              transactions={
                transactionOptions
              }
              invoices={
                invoiceOptions
              }
            />
          </div>
        )}

        {/* Transactions + Invoices */}

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {/* Unmatched Transactions */}

          <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-lg font-semibold">
              Unmatched Transactions
            </h2>

            {transactions.length ===
            0 ? (
              <p className="mt-4 text-sm text-slate-400">
                No unmatched credit
                transactions.
              </p>
            ) : (
              <div className="mt-5 space-y-3">
                {transactions.map(
                  (transaction) => (
                    <div
                      key={
                        transaction.id
                      }
                      className="rounded-lg border border-slate-800 bg-slate-950 p-4"
                    >
                      <p className="font-semibold">
                        ₹
                        {Number(
                          transaction.amount
                        ).toLocaleString(
                          "en-IN"
                        )}
                      </p>

                      <p className="mt-1 text-sm text-slate-300">
                        {transaction.description ||
                          "No description"}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Ref:{" "}
                        {transaction.reference ||
                          "—"}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {transaction.transactionDate.toLocaleDateString(
                          "en-IN"
                        )}
                      </p>
                    </div>
                  )
                )}
              </div>
            )}
          </section>

          {/* Open Invoices */}

          <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-lg font-semibold">
              Open Invoices
            </h2>

            {invoiceOptions.length ===
            0 ? (
              <p className="mt-4 text-sm text-slate-400">
                No open invoices available.
              </p>
            ) : (
              <div className="mt-5 space-y-3">
                {invoiceOptions.map(
                  (invoice) => (
                    <div
                      key={invoice.id}
                      className="rounded-lg border border-slate-800 bg-slate-950 p-4"
                    >
                      <p className="font-semibold">
                        {
                          invoice.invoiceNumber
                        }
                      </p>

                      <p className="mt-1 text-sm text-slate-300">
                        {
                          invoice.customerName
                        }
                      </p>

                      <p className="mt-1 text-sm text-cyan-400">
                        Balance: ₹
                        {invoice.balance.toLocaleString(
                          "en-IN"
                        )}
                      </p>
                    </div>
                  )
                )}
              </div>
            )}
          </section>
        </div>

        {/* Unallocated Customer Credits */}

        <section className="mt-8 rounded-xl border border-amber-700/50 bg-slate-900 p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Unallocated Customer
                Credits
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Excess payments that have
                not yet been applied to
                invoices.
              </p>
            </div>

            <div className="rounded-lg border border-amber-700/50 bg-amber-950/30 px-4 py-2">
              <p className="text-xs text-amber-300">
                Total Available Credit
              </p>

              <p className="mt-1 text-xl font-bold text-amber-400">
                ₹
                {totalUnallocatedCredit.toLocaleString(
                  "en-IN"
                )}
              </p>
            </div>
          </div>

          {unallocatedCredits.length ===
          0 ? (
            <p className="mt-5 text-sm text-slate-400">
              No unallocated customer
              credit.
            </p>
          ) : (
            <div className="mt-5 space-y-4">
              {unallocatedCredits.map(
                (credit) => {
                  /*
                   * Only invoices belonging
                   * to the same customer are
                   * supplied to ApplyCreditForm.
                   */

                  const customerInvoices =
                    credit.customerId
                      ? invoiceOptions.filter(
                          (invoice) =>
                            invoice.customerId ===
                            credit.customerId
                        )
                      : [];

                  return (
                    <div
                      key={credit.id}
                      className="rounded-lg border border-slate-800 bg-slate-950 p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-semibold">
                            {
                              credit.customerName
                            }
                          </p>

                          <p className="mt-1 text-sm text-slate-400">
                            Payment: ₹
                            {credit.paymentAmount.toLocaleString(
                              "en-IN"
                            )}
                          </p>

                          <p className="mt-1 text-sm text-slate-400">
                            Already allocated:
                            {" ₹"}
                            {credit.allocatedAmount.toLocaleString(
                              "en-IN"
                            )}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            Ref:{" "}
                            {credit.reference ||
                              "—"}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {credit.paymentDate.toLocaleDateString(
                              "en-IN"
                            )}
                          </p>
                        </div>

                        <div className="rounded-lg border border-amber-700/50 bg-amber-950/30 px-4 py-3">
                          <p className="text-xs text-amber-300">
                            Available Credit
                          </p>

                          <p className="mt-1 text-lg font-bold text-amber-400">
                            ₹
                            {credit.remainingCredit.toLocaleString(
                              "en-IN"
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Apply Customer Credit */}

                      {canManage && (
                        <div className="mt-5 border-t border-slate-800 pt-5">
                          {credit.customerId ? (
                            customerInvoices.length >
                            0 ? (
                              <ApplyCreditForm
                                paymentId={
                                  credit.id
                                }
                                availableCredit={
                                  credit.remainingCredit
                                }
                                customerName={
                                  credit.customerName
                                }
                                invoices={
                                  customerInvoices
                                }
                              />
                            ) : (
                              <p className="text-sm text-slate-500">
                                No open invoices
                                available for{" "}
                                {
                                  credit.customerName
                                }
                                .
                              </p>
                            )
                          ) : (
                            <p className="text-sm text-amber-400">
                              This payment is not
                              linked to a customer,
                              so its credit cannot
                              be applied.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                }
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}