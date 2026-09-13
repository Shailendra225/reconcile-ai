"use client";

import { FormEvent, useState } from "react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";

type Customer = {
  id: string;
  name: string;
};

export default function NewInvoiceForm({
  customers,
}: {
  customers: Customer[];
}) {
  const router = useRouter();
  const searchParams =
    useSearchParams();

  const customerIdFromUrl =
    searchParams.get("customerId");

  const [customerId, setCustomerId] =
    useState(
      customerIdFromUrl &&
        customers.some(
          (customer) =>
            customer.id ===
            customerIdFromUrl
        )
        ? customerIdFromUrl
        : customers[0]?.id ?? ""
    );

  const [
    invoiceNumber,
    setInvoiceNumber,
  ] = useState("");

  const [
    totalAmount,
    setTotalAmount,
  ] = useState("");

  const [
    dueDate,
    setDueDate,
  ] = useState("");

  const [notes, setNotes] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");

    const customer =
      customers.find(
        (item) =>
          item.id === customerId
      );

    if (!customer) {
      setError(
        "Please select a customer."
      );
      return;
    }

    setLoading(true);

    try {
      const response =
        await fetch(
          "/api/invoice",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              customerId,
              invoiceNumber,
              totalAmount:
                Number(totalAmount),
              dueDate:
                dueDate || null,
              notes:
                notes || null,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to create invoice"
        );
      }

      router.push("/invoices");
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
        <div className="mb-2 flex items-center justify-between">
          <label className="block text-sm text-slate-300">
            Customer
          </label>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/customers/new?returnTo=/invoices/new"
              )
            }
            className="text-sm font-medium text-cyan-400 hover:text-cyan-300"
          >
            + Add New Customer
          </button>
        </div>

        <select
          value={customerId}
          onChange={(e) =>
            setCustomerId(
              e.target.value
            )
          }
          required
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
        >
          {customers.length === 0 ? (
            <option value="">
              No customers
              available
            </option>
          ) : (
            customers.map(
              (customer) => (
                <option
                  key={
                    customer.id
                  }
                  value={
                    customer.id
                  }
                >
                  {
                    customer.name
                  }
                </option>
              )
            )
          )}
        </select>
      </div>

      <div>
        <label className="mb-2 block text-sm text-slate-300">
          Invoice Number
        </label>

        <input
          value={invoiceNumber}
          onChange={(e) =>
            setInvoiceNumber(
              e.target.value
            )
          }
          placeholder="INV-002"
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
            setTotalAmount(
              e.target.value
            )
          }
          placeholder="15000"
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
          min={
            new Date()
              .toISOString()
              .split("T")[0]
          }
          value={dueDate}
          onChange={(e) =>
            setDueDate(
              e.target.value
            )
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
            setNotes(
              e.target.value
            )
          }
          rows={4}
          placeholder="Optional notes..."
          className="w-full resize-none rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
        />
      </div>

      <button
        type="submit"
        disabled={
          loading ||
          customers.length === 0
        }
        className="w-full rounded-lg bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading
          ? "Creating..."
          : "Create Invoice"}
      </button>
    </form>
  );
}