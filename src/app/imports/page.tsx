import { redirect } from "next/navigation";

import CsvImportForm from "@/components/CsvImportForm";
import { getCurrentMembership } from "@/lib/getCurrentMembership";
import { canManageTransactions } from "@/lib/permissions";

export default async function ImportsPage() {
  // --------------------------------------------------
  // Current workspace membership
  // --------------------------------------------------

  const membership =
    await getCurrentMembership();

  if (!membership) {
    redirect("/login");
  }

  // --------------------------------------------------
  // Permission check
  // VIEWER cannot import bank transactions
  // --------------------------------------------------

  if (
    !canManageTransactions(
      membership.role
    )
  ) {
    redirect("/transactions");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-8 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm font-medium text-cyan-400">
          Reconcile AI
        </p>

        <h1 className="mt-2 text-3xl font-bold">
          Import Bank Statement
        </h1>

        <p className="mt-2 text-sm text-slate-400">
          Upload a CSV bank statement to import transactions
          for reconciliation.
        </p>

        <div className="mt-8">
          <CsvImportForm />
        </div>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-lg font-semibold">
            Required CSV Format
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            For the first version, use these column names:
          </p>

          <div className="mt-5 overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-950 text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left">
                    date
                  </th>

                  <th className="px-4 py-3 text-left">
                    description
                  </th>

                  <th className="px-4 py-3 text-left">
                    reference
                  </th>

                  <th className="px-4 py-3 text-left">
                    amount
                  </th>

                  <th className="px-4 py-3 text-left">
                    direction
                  </th>
                </tr>
              </thead>

              <tbody>
                <tr className="border-t border-slate-800">
                  <td className="px-4 py-3">
                    2026-09-13
                  </td>

                  <td className="px-4 py-3">
                    UPI from ABC Traders
                  </td>

                  <td className="px-4 py-3">
                    UTR987654321
                  </td>

                  <td className="px-4 py-3">
                    5000
                  </td>

                  <td className="px-4 py-3">
                    CREDIT
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}