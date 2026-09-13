import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { getCurrentBusiness } from "@/lib/getCurrentBusiness";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default async function TransactionsPage() {
    const business =
    await getCurrentBusiness();

  if (!business) {
    redirect("/login");
  }

  const transactions =
    await db.bankTransaction.findMany({
      where: {
        businessId: business.id,
      },
       orderBy: {
        transactionDate: "desc",
      },

      include: {
        matches: {
          include: {
            invoice: {
              include: {
                customer: true,
              },
            },
          },
        },

        payment: {
          include: {
            customer: true,
          },
        },
      },
    });

  const matchedCount = transactions.filter(
    (transaction) => transaction.status === "MATCHED"
  ).length;

  const unmatchedCount = transactions.filter(
    (transaction) => transaction.status === "UNMATCHED"
  ).length;

  const suggestedCount = transactions.filter(
    (transaction) => transaction.status === "SUGGESTED"
  ).length;

  return (
    <main className="min-h-screen bg-slate-950 px-8 py-10 text-white">
      <div className="mx-auto max-w-7xl">

        <div className="mb-8">
          <p className="text-sm font-medium text-cyan-400">
            Reconcile AI
          </p>

          <h1 className="mt-2 text-3xl font-bold">
            Bank Transactions
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Review incoming payments and their reconciliation status.
          </p>
        </div>

        <section className="mb-8 grid gap-4 sm:grid-cols-3">

          <SummaryCard
            label="Matched"
            value={matchedCount}
          />

          <SummaryCard
            label="Unmatched"
            value={unmatchedCount}
          />

          <SummaryCard
            label="Suggested Matches"
            value={suggestedCount}
          />

        </section>

        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">

          <div className="overflow-x-auto">

            <table className="w-full">

              <thead className="border-b border-slate-800">

                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">

                  <th className="px-6 py-4">
                    Date
                  </th>

                  <th className="px-6 py-4">
                    Description
                  </th>

                  <th className="px-6 py-4">
                    Reference
                  </th>

                  <th className="px-6 py-4">
                    Amount
                  </th>

                  <th className="px-6 py-4">
                    Match
                  </th>

                  <th className="px-6 py-4">
                    Status
                  </th>

                </tr>

              </thead>

              <tbody className="divide-y divide-slate-800">

                {transactions.map((transaction) => {

                  const confirmedMatch =
                    transaction.matches.find(
                      (match) =>
                        match.status === "CONFIRMED"
                    );

                  const suggestedMatch =
                    transaction.matches.find(
                      (match) =>
                        match.status === "SUGGESTED"
                    );

                  const match =
                    confirmedMatch ?? suggestedMatch;

                  return (
                    <tr
                      key={transaction.id}
                      className="transition hover:bg-slate-800/40"
                    >

                      <td className="whitespace-nowrap px-6 py-5 text-sm text-slate-400">
                        {formatDate(
                          transaction.transactionDate
                        )}
                      </td>

                      <td className="px-6 py-5">

                        <p className="font-medium">
                          {transaction.description}
                        </p>

                        {transaction.payment?.customer && (
                          <p className="mt-1 text-xs text-slate-500">
                            {
                              transaction.payment
                                .customer.name
                            }
                          </p>
                        )}

                      </td>

                      <td className="px-6 py-5 text-sm text-slate-400">
                        {transaction.reference || "—"}
                      </td>

                      <td className="whitespace-nowrap px-6 py-5 font-semibold">
                        {transaction.direction === "CREDIT"
                          ? "+"
                          : "-"}
                        {formatCurrency(
                          Number(transaction.amount)
                        )}
                      </td>

                      <td className="px-6 py-5">

                        {match ? (
                          <div>
                            <p className="text-sm font-medium">
                              {
                                match.invoice
                                  .invoiceNumber
                              }
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              {
                                match.invoice.customer
                                  .name
                              }
                            </p>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-500">
                            No match
                          </span>
                        )}

                      </td>

                      <td className="px-6 py-5">

                        <StatusBadge
                          status={transaction.status}
                        />

                      </td>

                    </tr>
                  );
                })}

                {transactions.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-16 text-center text-sm text-slate-500"
                    >
                      No bank transactions found.
                    </td>
                  </tr>
                )}

              </tbody>

            </table>

          </div>

        </div>

      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
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

function StatusBadge({
  status,
}: {
  status: string;
}) {
  return (
    <span className="inline-flex rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300">
      {status.replaceAll("_", " ")}
    </span>
  );
}