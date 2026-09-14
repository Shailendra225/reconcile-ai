import { redirect } from "next/navigation";

import ManualMatchForm from "@/components/ManualMatchForm";
import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/getCurrentBusiness";

export const dynamic = "force-dynamic";

export default async function ManualReconciliationPage() {
  const business = await getCurrentBusiness();

  if (!business) {
    redirect("/login");
  }

  const transactions =
    await db.bankTransaction.findMany({
      where: {
        businessId: business.id,
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

  const invoices =
    await db.invoice.findMany({
      where: {
        businessId: business.id,
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

  const transactionOptions =
    transactions.map((transaction) => ({
      id: transaction.id,
      amount: Number(transaction.amount),
      description: transaction.description,
      reference: transaction.reference,
      transactionDate:
        transaction.transactionDate.toISOString(),
    }));

  const invoiceOptions =
    invoices.map((invoice) => {
      const total =
        Number(invoice.totalAmount);

      const paid =
        invoice.allocations.reduce(
          (sum, allocation) =>
            sum +
            Number(allocation.amount),
          0
        );

      const balance =
        Math.max(total - paid, 0);

      return {
        id: invoice.id,
        invoiceNumber:
          invoice.invoiceNumber,
        customerName:
          invoice.customer.name,
        balance,
      };
    });

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
        </p>

        <div className="mt-8">
          <ManualMatchForm
            transactions={
              transactionOptions
            }
            invoices={invoiceOptions}
          />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-lg font-semibold">
              Unmatched Transactions
            </h2>

            {transactions.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400">
                No unmatched credit transactions.
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

          <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-lg font-semibold">
              Open Invoices
            </h2>

            {invoiceOptions.length === 0 ? (
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
      </div>
    </main>
  );
}