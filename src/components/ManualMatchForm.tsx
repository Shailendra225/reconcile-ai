"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type TransactionOption = {
  id: string;
  amount: number;
  description: string | null;
  reference: string | null;
  transactionDate: string;
};

type InvoiceOption = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  balance: number;
};

type Props = {
  transactions: TransactionOption[];
  invoices: InvoiceOption[];
};

export default function ManualMatchForm({
  transactions,
  invoices,
}: Props) {
  const router = useRouter();

  const [transactionId, setTransactionId] =
    useState("");

  const [invoiceId, setInvoiceId] =
    useState("");

  const [allocationAmount, setAllocationAmount] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const selectedTransaction =
    useMemo(
      () =>
        transactions.find(
          (transaction) =>
            transaction.id === transactionId
        ),
      [transactionId, transactions]
    );

  const selectedInvoice =
    useMemo(
      () =>
        invoices.find(
          (invoice) =>
            invoice.id === invoiceId
        ),
      [invoiceId, invoices]
    );

  function autoFillAmount(
    nextTransactionId: string,
    nextInvoiceId: string
  ) {
    const transaction =
      transactions.find(
        (item) =>
          item.id === nextTransactionId
      );

    const invoice =
      invoices.find(
        (item) =>
          item.id === nextInvoiceId
      );

    if (!transaction || !invoice) {
      return;
    }

    const amount =
      Math.min(
        transaction.amount,
        invoice.balance
      );

    setAllocationAmount(
      amount.toString()
    );
  }

  async function handleSubmit(
    event: React.FormEvent
  ) {
    event.preventDefault();

    setMessage("");

    if (
      !transactionId ||
      !invoiceId ||
      !allocationAmount
    ) {
      setMessage(
        "Please select transaction, invoice and amount."
      );
      return;
    }

    setLoading(true);

    try {
      const response =
        await fetch(
          "/api/reconciliation/manual",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              transactionId,
              invoiceId,
              allocationAmount:
                Number(allocationAmount),
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        setMessage(
          data.message ||
            "Manual reconciliation failed."
        );

        setLoading(false);
        return;
      }

      setMessage(
        "Manual match completed successfully."
      );

      setTransactionId("");
      setInvoiceId("");
      setAllocationAmount("");

      router.refresh();
    } catch {
      setMessage(
        "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
      <h2 className="text-xl font-semibold">
        Create Manual Match
      </h2>

      <p className="mt-2 text-sm text-slate-400">
        Select a bank transaction and an
        invoice to manually reconcile them.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-5"
      >
        <div>
          <label className="mb-2 block text-sm font-medium">
            Bank Transaction
          </label>

          <select
            value={transactionId}
            onChange={(event) => {
              const value =
                event.target.value;

              setTransactionId(value);

              autoFillAmount(
                value,
                invoiceId
              );
            }}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-cyan-400"
          >
            <option value="">
              Select transaction
            </option>

            {transactions.map(
              (transaction) => (
                <option
                  key={transaction.id}
                  value={transaction.id}
                >
                  ₹
                  {transaction.amount.toLocaleString(
                    "en-IN"
                  )}{" "}
                  -{" "}
                  {transaction.description ||
                    transaction.reference ||
                    "Bank Transaction"}
                </option>
              )
            )}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Invoice
          </label>

          <select
            value={invoiceId}
            onChange={(event) => {
              const value =
                event.target.value;

              setInvoiceId(value);

              autoFillAmount(
                transactionId,
                value
              );
            }}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-cyan-400"
          >
            <option value="">
              Select invoice
            </option>

            {invoices.map(
              (invoice) => (
                <option
                  key={invoice.id}
                  value={invoice.id}
                >
                  {
                    invoice.invoiceNumber
                  }{" "}
                  -{" "}
                  {
                    invoice.customerName
                  }{" "}
                  - Balance ₹
                  {invoice.balance.toLocaleString(
                    "en-IN"
                  )}
                </option>
              )
            )}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Allocation Amount
          </label>

          <input
            type="number"
            min="0"
            step="0.01"
            value={allocationAmount}
            onChange={(event) =>
              setAllocationAmount(
                event.target.value
              )
            }
            placeholder="Enter amount"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-cyan-400"
          />

          {selectedTransaction && (
            <p className="mt-2 text-xs text-slate-500">
              Transaction amount: ₹
              {selectedTransaction.amount.toLocaleString(
                "en-IN"
              )}
            </p>
          )}

          {selectedInvoice && (
            <p className="mt-1 text-xs text-slate-500">
              Invoice balance: ₹
              {selectedInvoice.balance.toLocaleString(
                "en-IN"
              )}
            </p>
          )}
        </div>

        {message && (
          <div className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm">
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={
            loading ||
            transactions.length === 0 ||
            invoices.length === 0
          }
          className="w-full rounded-lg bg-cyan-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading
            ? "Matching..."
            : "Confirm Manual Match"}
        </button>
      </form>
    </section>
  );
}
