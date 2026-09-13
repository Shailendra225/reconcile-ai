import Link from "next/link";
import { db } from "@/lib/db";
import ConfirmMatchButton from "@/components/ConfirmMatchButton";
import RunReconciliationButton from "@/components/RunReconciliationButton";
import RejectMatchButton from "@/components/RejectMatchButton";
import { redirect } from "next/navigation";
import { getCurrentBusiness } from "@/lib/getCurrentBusiness";

export const dynamic = "force-dynamic";

export default async function ReconciliationPage() {
  const business =
    await getCurrentBusiness();

  if (!business) {
    redirect("/login");
  }

  const matches =
    await db.reconciliationMatch.findMany({
      where: {
        status: "SUGGESTED",

        bankTransaction: {
          businessId: business.id,
        },
      },

      include: {
        bankTransaction: true,

        invoice: {
          include: {
            customer: true,
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });
    
  const groupedMatches =
    new Map<
      string,
      typeof matches
    >();

  for (const match of matches) {
    const transactionId =
      match.bankTransactionId;

    const existing =
      groupedMatches.get(
        transactionId
      ) ?? [];

    existing.push(match);

    groupedMatches.set(
      transactionId,
      existing
    );
  }

  const groups =
    Array.from(
      groupedMatches.values()
    );

  return (
    <main className="min-h-screen bg-slate-950 px-8 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-medium text-cyan-400">
          Reconcile AI
        </p>

        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              Reconciliation
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              Review suggested payment matches before confirming them.
            </p>
          </div>

          <div className="flex items-start gap-3">
            <RunReconciliationButton />

            <Link
              href="/transactions"
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium hover:bg-slate-800"
            >
              View Transactions
            </Link>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">
              Suggested Transactions
            </p>

            <p className="mt-2 text-3xl font-bold">
              {groups.length}
            </p>
          </div>
        </div>

        <section className="mt-8">
          {groups.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-10 text-center">
              <h2 className="text-lg font-semibold">
                No suggested matches
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                Run reconciliation after importing new bank transactions.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {groups.map(
                (group) => {
                  const firstMatch =
                    group[0];

                  const transaction =
                    firstMatch.bankTransaction;

                  const isCombined =
                    group.length > 1;

                  const confidence =
                    Math.round(
                      Math.max(
                        ...group.map(
                          (match) =>
                            Number(
                              match.confidenceScore
                            )
                        )
                      ) * 100
                    );

                  const totalMatched =
                    group.reduce(
                      (
                        total,
                        match
                      ) =>
                        total +
                        Number(
                          match.matchedAmount ??
                            0
                        ),
                      0
                    );

                  return (
                    <div
                      key={
                        transaction.id
                      }
                      className="rounded-xl border border-slate-800 bg-slate-900 p-6"
                    >
                      <div className="flex flex-col justify-between gap-6 lg:flex-row">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400">
                              SUGGESTED
                            </span>

                            <span className="text-sm font-semibold text-cyan-400">
                              {confidence}%
                              confidence
                            </span>

                            {isCombined && (
                              <span className="rounded-full bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-400">
                                COMBINED PAYMENT
                              </span>
                            )}
                          </div>

                          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <div>
                              <p className="text-xs uppercase text-slate-500">
                                Transaction
                              </p>

                              <p className="mt-1 text-sm">
                                {
                                  transaction.description
                                }
                              </p>
                            </div>

                            <div>
                              <p className="text-xs uppercase text-slate-500">
                                Reference
                              </p>

                              <p className="mt-1 text-sm">
                                {transaction.reference ??
                                  "—"}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs uppercase text-slate-500">
                                Transaction Amount
                              </p>

                              <p className="mt-1 font-semibold">
                                ₹
                                {Number(
                                  transaction.amount
                                ).toLocaleString(
                                  "en-IN"
                                )}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs uppercase text-slate-500">
                                Total Matched
                              </p>

                              <p className="mt-1 font-semibold">
                                ₹
                                {totalMatched.toLocaleString(
                                  "en-IN"
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="mt-6">
                            <p className="text-xs font-semibold uppercase text-slate-500">
                              Invoice Allocation
                            </p>

                            <div className="mt-3 overflow-hidden rounded-lg border border-slate-800">
                              {group.map(
                                (
                                  match
                                ) => (
                                  <div
                                    key={
                                      match.id
                                    }
                                    className="flex flex-col justify-between gap-3 border-b border-slate-800 bg-slate-950 px-4 py-4 last:border-b-0 sm:flex-row sm:items-center"
                                  >
                                    <div>
                                      <Link
                                        href={`/invoices/${match.invoiceId}`}
                                        className="font-semibold hover:text-cyan-400"
                                      >
                                        {
                                          match
                                            .invoice
                                            .invoiceNumber
                                        }
                                      </Link>

                                      <p className="mt-1 text-sm text-slate-400">
                                        {match
                                          .invoice
                                          .customer
                                          ?.name ??
                                          "Unknown customer"}
                                      </p>
                                    </div>

                                    <div className="text-left sm:text-right">
                                      <p className="text-xs uppercase text-slate-500">
                                        Allocated
                                      </p>

                                      <p className="mt-1 font-semibold">
                                        ₹
                                        {Number(
                                          match.matchedAmount ??
                                            0
                                        ).toLocaleString(
                                          "en-IN"
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                )
                              )}
                            </div>
                          </div>

                          <div className="mt-5 rounded-lg bg-slate-950 p-4">
                            <p className="text-xs font-semibold uppercase text-slate-500">
                              Why this match?
                            </p>

                            <p className="mt-2 text-sm text-slate-300">
                              {firstMatch.reason ??
                                "Matching rules identified this payment as a suitable candidate."}
                            </p>
                          </div>
                        </div>

                        <div className="flex min-w-[170px] flex-col items-stretch gap-3">
                          <ConfirmMatchButton
                            matchId={
                              firstMatch.id
                            }
                          />

                          <RejectMatchButton
                            matchId={
                              firstMatch.id
                            }
                          />

                          {group.length ===
                            1 && (
                            <Link
                              href={`/invoices/${firstMatch.invoiceId}`}
                              className="rounded-lg border border-slate-700 px-4 py-2 text-center text-sm font-medium hover:bg-slate-800"
                            >
                              View Invoice
                            </Link>
                          )}
                        </div>
                      </div>
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