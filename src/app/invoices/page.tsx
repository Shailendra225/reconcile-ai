import Link from "next/link";
import { db } from "@/lib/db";
import { updateOverdueInvoices } from "@/lib/updateOverdueInvoices";
import { redirect } from "next/navigation";
import { getCurrentMembership } from "@/lib/getCurrentMembership";
import { canManageInvoices } from "@/lib/permissions";

export const dynamic = "force-dynamic";

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

export default async function InvoicesPage() {
  // --------------------------------------------------
  // Current workspace membership
  // --------------------------------------------------

  const membership =
    await getCurrentMembership();

  if (!membership) {
    redirect("/login");
  }

  const BUSINESS_ID =
    membership.businessId;

  const canManage =
    canManageInvoices(
      membership.role
    );

  // --------------------------------------------------
  // Update overdue invoices only when user
  // has invoice management permission.
  //
  // VIEWER must remain read-only.
  // --------------------------------------------------

  if (canManage) {
    await updateOverdueInvoices(
      BUSINESS_ID
    );
  }

  // --------------------------------------------------
  // Fetch invoices for current workspace
  // --------------------------------------------------

  const invoices =
    await db.invoice.findMany({
      where: {
        businessId: BUSINESS_ID,
      },

      orderBy: {
        createdAt: "desc",
      },

      select: {
        id: true,
        invoiceNumber: true,
        totalAmount: true,
        dueDate: true,
        status: true,

        customer: {
          select: {
            name: true,
          },
        },

        allocations: {
          select: {
            amount: true,
          },
        },
      },
    });

  return (
    <main className="min-h-screen bg-slate-950 px-8 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-cyan-400">
              Reconcile AI
            </p>

            <h1 className="mt-2 text-3xl font-bold">
              Invoices
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              Manage and track customer invoices.
            </p>
          </div>

          {canManage && (
            <Link
              href="/invoices/new"
              className="rounded-lg bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              + New Invoice
            </Link>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-800 bg-slate-900/70">
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-6 py-4">
                    Invoice
                  </th>

                  <th className="px-6 py-4">
                    Customer
                  </th>

                  <th className="px-6 py-4">
                    Due Date
                  </th>

                  <th className="px-6 py-4">
                    Amount
                  </th>

                  <th className="px-6 py-4">
                    Paid
                  </th>

                  <th className="px-6 py-4">
                    Status
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800">
                {invoices.map(
                  (invoice) => {
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

                    return (
                      <tr
                        key={invoice.id}
                        className="transition hover:bg-slate-800/40"
                      >
                        <td className="px-6 py-5">
                          <Link
                            href={`/invoices/${invoice.id}`}
                            className="font-semibold text-white hover:text-cyan-400"
                          >
                            {
                              invoice.invoiceNumber
                            }
                          </Link>
                        </td>

                        <td className="px-6 py-5 text-sm text-slate-300">
                          {
                            invoice.customer
                              .name
                          }
                        </td>

                        <td className="px-6 py-5 text-sm text-slate-400">
                          {formatDate(
                            invoice.dueDate
                          )}
                        </td>

                        <td className="px-6 py-5 font-medium text-white">
                          {formatCurrency(
                            Number(
                              invoice.totalAmount
                            )
                          )}
                        </td>

                        <td className="px-6 py-5 text-sm text-slate-300">
                          {formatCurrency(
                            totalPaid
                          )}
                        </td>

                        <td className="px-6 py-5">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${
                              invoice.status ===
                              "OVERDUE"
                                ? "bg-red-500/10 text-red-400"
                                : invoice.status ===
                                  "PAID"
                                ? "bg-emerald-500/10 text-emerald-400"
                                : invoice.status ===
                                  "PARTIALLY_PAID"
                                ? "bg-amber-500/10 text-amber-400"
                                : "bg-slate-800 text-slate-300"
                            }`}
                          >
                            {invoice.status.replaceAll(
                              "_",
                              " "
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  }
                )}

                {invoices.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-16 text-center text-sm text-slate-500"
                    >
                      No invoices found.
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