import Link from "next/link";
import { db } from "@/lib/db";
import { updateOverdueInvoices } from "@/lib/updateOverdueInvoices";
import { getCurrentBusiness } from "@/lib/getCurrentBusiness";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/getCurrentUser";
import LogoutButton from "@/components/LogoutButton";


export const dynamic = "force-dynamic";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function HomePage() {

  const user = await getCurrentUser();

if (!user) {
  redirect("/login");
}

  const business = await getCurrentBusiness();

if (!business) {
  return (
    <main className="min-h-screen bg-slate-950 px-8 py-10 text-white">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <h1 className="text-2xl font-bold">
          Business workspace not found
        </h1>

        <p className="mt-3 text-sm text-slate-400">
          Your account is not linked to a business workspace yet.
        </p>
      </div>
    </main>
  );
}

const BUSINESS_ID = business.id;
  await updateOverdueInvoices(
  BUSINESS_ID
);

  const [
    invoices,
    received,
    unmatchedTransactions,
    suggestedTransactions,
    recentInvoices,
    recentTransactions,
  ] = await Promise.all([
    db.invoice.findMany({
      where: {
        businessId: BUSINESS_ID,
      },

      select: {
        id: true,
        status: true,
        totalAmount: true,

        allocations: {
          select: {
            amount: true,
          },
        },
      },
    }),

    db.payment.aggregate({
      where: {
        businessId: BUSINESS_ID,
      },

      _sum: {
        amount: true,
      },
    }),

    db.bankTransaction.count({
      where: {
        businessId: BUSINESS_ID,
        status: "UNMATCHED",
      },
    }),

    db.bankTransaction.count({
      where: {
        businessId: BUSINESS_ID,
        status: "SUGGESTED",
      },
    }),

    db.invoice.findMany({
      where: {
        businessId: BUSINESS_ID,
      },

      take: 5,

      orderBy: {
        createdAt: "desc",
      },

      select: {
        id: true,
        invoiceNumber: true,
        totalAmount: true,
        status: true,

        customer: {
          select: {
            name: true,
          },
        },
      },
    }),

    db.bankTransaction.findMany({
      where: {
        businessId: BUSINESS_ID,
      },

      take: 5,

      orderBy: {
        transactionDate: "desc",
      },

      select: {
        id: true,
        description: true,
        reference: true,
        amount: true,
        direction: true,
        status: true,
      },
    }),
  ]);

  let totalReceivables = 0;
  let outstandingAmount = 0;

  let paidInvoiceCount = 0;
  let partialInvoiceCount = 0;
  let unpaidInvoiceCount = 0;

  for (const invoice of invoices) {
    const invoiceTotal =
      Number(invoice.totalAmount);

    const paid =
      invoice.allocations.reduce(
        (sum, allocation) =>
          sum +
          Number(allocation.amount),
        0
      );

    const balance =
      Math.max(
        invoiceTotal - paid,
        0
      );

    if (
      invoice.status !==
      "CANCELLED"
    ) {
      totalReceivables +=
        invoiceTotal;
    }

    if (
      [
        "SENT",
        "PARTIALLY_PAID",
        "OVERDUE",
      ].includes(invoice.status)
    ) {
      outstandingAmount +=
        balance;
    }

    if (
      invoice.status === "PAID"
    ) {
      paidInvoiceCount++;
    }

    if (
      invoice.status ===
      "PARTIALLY_PAID"
    ) {
      partialInvoiceCount++;
    }

    if (
      [
        "DRAFT",
        "SENT",
        "OVERDUE",
      ].includes(invoice.status)
    ) {
      unpaidInvoiceCount++;
    }
  }

  const totalReceived =
    Number(
      received._sum.amount ?? 0
    );

  return (
    <main className="min-h-screen bg-slate-950 px-8 py-10 text-white">
      <div className="mx-auto max-w-7xl">

        {/* HEADER */}

        <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-medium text-cyan-400">
              Reconcile AI
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              Payment Reconciliation Dashboard
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              Track invoices, collections and bank transaction reconciliation.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
  <Link
    href="/invoices/new"
    className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
  >
    + New Invoice
  </Link>

  <Link
    href="/imports"
    className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium transition hover:bg-slate-800"
  >
    Import Statement
  </Link>

  <LogoutButton />
</div>
        </div>

        {/* MAIN FINANCIAL CARDS */}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <DashboardCard
            label="Total Receivables"
            value={formatCurrency(
              totalReceivables
            )}
          />

          <DashboardCard
            label="Total Received"
            value={formatCurrency(
              totalReceived
            )}
          />

          <DashboardCard
            label="Outstanding Amount"
            value={formatCurrency(
              outstandingAmount
            )}
          />

          <DashboardCard
            label="Unmatched Transactions"
            value={
              unmatchedTransactions.toString()
            }
          />
        </section>

        {/* STATUS CARDS */}

        <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <SmallCard
            label="Total Invoices"
            value={
              invoices.length
            }
          />

          <SmallCard
            label="Paid Invoices"
            value={
              paidInvoiceCount
            }
          />

          <SmallCard
            label="Partially Paid"
            value={
              partialInvoiceCount
            }
          />

          <SmallCard
            label="Suggested Transactions"
            value={
              suggestedTransactions
            }
          />
        </section>

        <section className="mt-4 grid gap-4 sm:grid-cols-2">

          <SmallCard
            label="Open / Unpaid"
            value={
              unpaidInvoiceCount
            }
          />

          <SmallCard
            label="Collection Rate"
            value={
              totalReceivables > 0
                ? Math.round(
                    (totalReceived /
                      totalReceivables) *
                      100
                  )
                : 0
            }
            suffix="%"
          />
        </section>

        {/* RECENT DATA */}

        <div className="mt-10 grid gap-6 xl:grid-cols-2">

          {/* INVOICES */}

          <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">

            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-5">

              <h2 className="text-lg font-semibold">
                Recent Invoices
              </h2>

              <Link
                href="/invoices"
                className="text-sm font-medium text-cyan-400 hover:text-cyan-300"
              >
                View all
              </Link>
            </div>

            {recentInvoices.length ===
            0 ? (
              <EmptyState text="No invoices found." />
            ) : (
              <div className="divide-y divide-slate-800">

                {recentInvoices.map(
                  (invoice) => (
                    <Link
                      key={
                        invoice.id
                      }
                      href={`/invoices/${invoice.id}`}
                      className="flex items-center justify-between gap-4 px-6 py-5 transition hover:bg-slate-800/40"
                    >
                      <div>
                        <p className="font-medium">
                          {
                            invoice.invoiceNumber
                          }
                        </p>

                        <p className="mt-1 text-sm text-slate-400">
                          {
                            invoice.customer
                              .name
                          }
                        </p>
                      </div>

                      <div className="text-right">

                        <p className="font-semibold">
                          {formatCurrency(
                            Number(
                              invoice.totalAmount
                            )
                          )}
                        </p>

                        <span
  className={`mt-1 inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
    invoice.status === "OVERDUE"
      ? "bg-red-500/10 text-red-400"
      : invoice.status === "PAID"
      ? "bg-emerald-500/10 text-emerald-400"
      : invoice.status === "PARTIALLY_PAID"
      ? "bg-amber-500/10 text-amber-400"
      : "bg-slate-800 text-slate-300"
  }`}
>
  {invoice.status.replaceAll(
    "_",
    " "
  )}
</span>
                      </div>
                    </Link>
                  )
                )}
              </div>
            )}
          </section>

          {/* TRANSACTIONS */}

          <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">

            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-5">

              <h2 className="text-lg font-semibold">
                Recent Bank Transactions
              </h2>

              <Link
                href="/transactions"
                className="text-sm font-medium text-cyan-400 hover:text-cyan-300"
              >
                View all
              </Link>
            </div>

            {recentTransactions.length ===
            0 ? (
              <EmptyState text="No bank transactions found." />
            ) : (
              <div className="divide-y divide-slate-800">

                {recentTransactions.map(
                  (transaction) => (
                    <div
                      key={
                        transaction.id
                      }
                      className="px-6 py-5"
                    >
                      <div className="flex items-start justify-between gap-4">

                        <div>
                          <p className="font-medium">
                            {
                              transaction.description
                            }
                          </p>

                          <p className="mt-1 text-sm text-slate-400">
                            {transaction.reference ||
                              "No reference"}
                          </p>
                        </div>

                        <div className="text-right">

                          <p className="font-semibold">
                            {transaction.direction ===
                            "CREDIT"
                              ? "+"
                              : "-"}
                            {formatCurrency(
                              Number(
                                transaction.amount
                              )
                            )}
                          </p>

                          <span className="mt-1 inline-block rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                            {
                              transaction.status
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function DashboardCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <p className="text-sm text-slate-400">
        {label}
      </p>

      <p className="mt-3 text-3xl font-bold">
        {value}
      </p>
    </div>
  );
}

function SmallCard({
  label,
  value,
  suffix = "",
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 px-5 py-4">

      <p className="text-sm text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-2xl font-semibold">
        {value}
        {suffix}
      </p>
    </div>
  );
}

function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <div className="px-6 py-12 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}