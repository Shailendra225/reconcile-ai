import Link from "next/link";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { getCurrentMembership } from "@/lib/getCurrentMembership";
import { canManageCustomers } from "@/lib/permissions";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
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
    canManageCustomers(
      membership.role
    );

  // --------------------------------------------------
  // Fetch customers for current workspace
  // --------------------------------------------------

  const customers =
    await db.customer.findMany({
      where: {
        businessId: BUSINESS_ID,
      },

      orderBy: {
        createdAt: "desc",
      },

      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        upiId: true,
        gstNumber: true,

        _count: {
          select: {
            invoices: true,
          },
        },

        invoices: {
          where: {
            status: {
              in: [
                "SENT",
                "PARTIALLY_PAID",
                "OVERDUE",
              ],
            },
          },

          select: {
            totalAmount: true,

            allocations: {
              select: {
                amount: true,
              },
            },
          },
        },
      },
    });

  return (
    <main className="min-h-screen bg-slate-950 px-8 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-cyan-400">
              Reconcile AI
            </p>

            <h1 className="mt-2 text-3xl font-bold">
              Customers
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              Manage customers and track their outstanding invoices.
            </p>
          </div>

          {canManage && (
            <Link
              href="/customers/new"
              className="rounded-lg bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              + New Customer
            </Link>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-800">
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-6 py-4">
                    Customer
                  </th>

                  <th className="px-6 py-4">
                    Contact
                  </th>

                  <th className="px-6 py-4">
                    UPI ID
                  </th>

                  <th className="px-6 py-4">
                    Invoices
                  </th>

                  <th className="px-6 py-4">
                    Outstanding
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800">
                {customers.map(
                  (customer) => {
                    const outstanding =
                      customer.invoices.reduce(
                        (
                          total,
                          invoice
                        ) => {
                          const paid =
                            invoice.allocations.reduce(
                              (
                                sum,
                                allocation
                              ) =>
                                sum +
                                Number(
                                  allocation.amount
                                ),
                              0
                            );

                          const balance =
                            Number(
                              invoice.totalAmount
                            ) - paid;

                          return (
                            total +
                            Math.max(
                              balance,
                              0
                            )
                          );
                        },
                        0
                      );

                    return (
                      <tr
                        key={customer.id}
                        className="transition hover:bg-slate-800/40"
                      >
                        <td className="px-6 py-5">
                          <Link
                            href={`/customers/${customer.id}`}
                            className="font-semibold hover:text-cyan-400"
                          >
                            {
                              customer.name
                            }
                          </Link>

                          {customer.gstNumber && (
                            <p className="mt-1 text-xs text-slate-500">
                              GST:{" "}
                              {
                                customer.gstNumber
                              }
                            </p>
                          )}
                        </td>

                        <td className="px-6 py-5 text-sm text-slate-300">
                          <p>
                            {customer.email ||
                              "—"}
                          </p>

                          <p className="mt-1 text-slate-500">
                            {customer.phone ||
                              "—"}
                          </p>
                        </td>

                        <td className="px-6 py-5 text-sm text-slate-300">
                          {customer.upiId ||
                            "—"}
                        </td>

                        <td className="px-6 py-5 font-medium">
                          {
                            customer._count
                              .invoices
                          }
                        </td>

                        <td className="px-6 py-5 font-semibold">
                          {formatCurrency(
                            outstanding
                          )}
                        </td>
                      </tr>
                    );
                  }
                )}

                {customers.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-16 text-center text-sm text-slate-500"
                    >
                      No customers found.
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