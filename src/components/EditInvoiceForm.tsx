"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Invoice = {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  dueDate: string;
  notes: string;
};

export default function EditInvoiceForm({
  invoice,
}: {
  invoice: Invoice;
}) {
  const router = useRouter();

  const [invoiceNumber, setInvoiceNumber] =
    useState(invoice.invoiceNumber);

  const [totalAmount, setTotalAmount] =
    useState(invoice.totalAmount.toString());

  const [dueDate, setDueDate] =
    useState(invoice.dueDate);

  const [notes, setNotes] =
    useState(invoice.notes);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await fetch(
        `/api/invoice/${invoice.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            invoiceNumber,
            totalAmount: Number(totalAmount),
            dueDate: dueDate || null,
            notes: notes || null,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to update invoice"
        );
      }

      router.push(`/invoices/${invoice.id}`);
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900 p-6"
    >
      {error && (
        <div className="rounded-lg border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div>
        <label className="mb-2 block text-sm text-slate-300">
          Invoice Number
        </label>

        <input
          value={invoiceNumber}
          onChange={(e) =>
            setInvoiceNumber(e.target.value)
          }
          required
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm text-slate-300">
          Amount
        </label>

        <input
          type="number"
          min="0.01"
          step="0.01"
          value={totalAmount}
          onChange={(e) =>
            setTotalAmount(e.target.value)
          }
          required
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm text-slate-300">
          Due Date
        </label>

        <input
          type="date"
          value={dueDate}
          onChange={(e) =>
            setDueDate(e.target.value)
          }
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm text-slate-300">
          Notes
        </label>

        <textarea
          value={notes}
          onChange={(e) =>
            setNotes(e.target.value)
          }
          rows={4}
          className="w-full resize-none rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"
      >
        {loading
          ? "Saving..."
          : "Save Changes"}
      </button>
    </form>
  );
}