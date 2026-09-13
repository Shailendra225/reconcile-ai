import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";

import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/getCurrentBusiness";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(date: Date | null) {
  if (!date) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const business =
    await getCurrentBusiness();

  if (!business) {
    redirect("/login");
  }

  const { id } = await params;

  const invoice =
    await db.invoice.findFirst({
      where: {
        id,
        businessId:
          business.id,
      },

      include: {
        customer: true,

        allocations: {
          include: {
            payment: {
              include: {
                bankTransaction:
                  true,
              },
            },
          },
        },

        matches: {
          include: {
            bankTransaction:
              true,
          },
        },
      },
    });

  if (!invoice) {
    notFound();
  }

  const totalPaid =
    invoice.allocations.reduce(
      (
        total,
        allocation
      ) =>
        total +
        Number(
          allocation.amount
        ),
      0
    );

  const totalAmount =
    Number(
      invoice.totalAmount
    );

  const balanceDue =
    Math.max(
      totalAmount -
        totalPaid,
      0
    );

  return (
    <main className="min-h-screen bg-slate-950 px-8 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <Link
            href="/invoices"
            className="text-sm text-cyan-400 hover:text-cyan-300"
          >
            ← Back to Invoices
          </Link>

          <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-slate-400">
                Invoice
              </p>

              <h1 className="mt-1 text-3xl font-bold">
                {
                  invoice.invoiceNumber
                }
              </h1>

              <p className="mt-2 text-slate-400">
                {
                  invoice.customer
                    .name
                }
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="rounded-full bg-slate-800 px-4 py-2 text-xs font-semibold">
                {invoice.status.replaceAll(
                  "_",
                  " "
                )}
              </span>

              <Link
                href={`/invoices/${invoice.id}/edit`}
                className="rounded-lg bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
              >
                Edit Invoice
              </Link>
            </div>
          </div>
        </div>

        <section className="grid gap-4 sm:grid-cols-3">
          <SummaryCard
            label="Invoice Amount"
            value={formatCurrency(
              totalAmount
            )}
          />

          <SummaryCard
            label="Total Paid"
            value={formatCurrency(
              totalPaid
            )}
          />

          <SummaryCard
            label="Balance Due"
            value={formatCurrency(
              balanceDue
            )}
          />
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-lg font-semibold">
              Invoice Details
            </h2>

            <div className="mt-6 space-y-5">
              <DetailRow
                label="Invoice Number"
                value={
                  invoice.invoiceNumber
                }
              />

              <DetailRow
                label="Due Date"
                value={formatDate(
                  invoice.dueDate
                )}
              />

              <DetailRow
                label="Status"
                value={invoice.status.replaceAll(
                  "_",
                  " "
                )}
              />

              <DetailRow
                label="Notes"
                value={
                  invoice.notes ||
                  "—"
                }
              />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-lg font-semibold">
              Customer
            </h2>

            <div className="mt-6 space-y-5">
              <DetailRow
                label="Name"
                value={
                  invoice.customer
                    .name
                }
              />

              <DetailRow
                label="Email"
                value={
                  invoice.customer
                    .email || "—"
                }
              />

              <DetailRow
                label="Phone"
                value={
                  invoice.customer
                    .phone || "—"
                }
              />

              <DetailRow
                label="UPI ID"
                value={
                  invoice.customer
                    .upiId || "—"
                }
              />

              <DetailRow
                label="GST Number"
                value={
                  invoice.customer
                    .gstNumber || "—"
                }
              />
            </div>
          </section>
        </div>

        <section className="mt-8 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 px-6 py-5">
            <h2 className="text-lg font-semibold">
              Payments
            </h2>
          </div>

          {invoice.allocations.length ===
          0 ? (
            <div className="px-6 py-10 text-sm text-slate-500">
              No payments have been allocated to this invoice.
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {invoice.allocations.map(
                (
                  allocation
                ) => (
                  <div
                    key={
                      allocation.id
                    }
                    className="flex flex-wrap items-center justify-between gap-4 px-6 py-5"
                  >
                    <div>
                      <p className="font-medium">
                        {allocation
                          .payment
                          .reference ||
                          "Payment"}
                      </p>

                      <p className="mt-1 text-sm text-slate-400">
                        {formatDate(
                          allocation
                            .payment
                            .paymentDate
                        )}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-semibold">
                        {formatCurrency(
                          Number(
                            allocation.amount
                          )
                        )}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {allocation.payment.source.replaceAll(
                          "_",
                          " "
                        )}
                      </p>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 px-6 py-5">
            <h2 className="text-lg font-semibold">
              Reconciliation
            </h2>
          </div>

          {invoice.matches.length ===
          0 ? (
            <div className="px-6 py-10 text-sm text-slate-500">
              No reconciliation matches found.
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {invoice.matches.map(
                (match) => (
                  <div
                    key={
                      match.id
                    }
                    className="px-6 py-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="font-medium">
                          {
                            match
                              .bankTransaction
                              .description
                          }
                        </p>

                        <p className="mt-1 text-sm text-slate-400">
                          {match.reason ||
                            "No match reason"}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="font-semibold">
                          {Math.round(
                            match.confidenceScore *
                              100
                          )}
                          % confidence
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {
                            match.status
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function SummaryCard({
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

      <p className="mt-3 text-2xl font-bold">
        {value}
      </p>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex justify-between gap-6 border-b border-slate-800 pb-4 last:border-0 last:pb-0">
      <span className="text-sm text-slate-400">
        {label}
      </span>

      <span className="text-right text-sm font-medium">
        {value}
      </span>
    </div>
  );
}