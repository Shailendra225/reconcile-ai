"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type InvoiceOption = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  balance: number;
};

type Props = {
  paymentId: string;
  availableCredit: number;
  customerName: string;
  invoices: InvoiceOption[];
};

export default function ApplyCreditForm({
  paymentId,
  availableCredit,
  customerName,
  invoices,
}: Props) {
  const router = useRouter();

  const [invoiceId, setInvoiceId] =
    useState("");

  const [allocationAmount, setAllocationAmount] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const selectedInvoice = useMemo(
    () =>
      invoices.find(
        (invoice) => invoice.id === invoiceId
      ),
    [invoiceId, invoices]
  );

  const allocationNumber =
    Number(allocationAmount || 0);

  const remainingCredit = Math.max(
    availableCredit - allocationNumber,
    0
  );

  const invoiceBalanceAfter =
    selectedInvoice
      ? Math.max(
          selectedInvoice.balance -
            allocationNumber,
          0
        )
      : 0;

  const allocationIsTooHigh =
    !!selectedInvoice &&
    (allocationNumber > availableCredit ||
      allocationNumber >
        selectedInvoice.balance);

  function handleInvoiceChange(
    nextInvoiceId: string
  ) {
    setInvoiceId(nextInvoiceId);
    setMessage("");

    const invoice = invoices.find(
      (item) => item.id === nextInvoiceId
    );

    if (!invoice) {
      setAllocationAmount("");
      return;
    }

    const amount = Math.min(
      availableCredit,
      invoice.balance
    );

    setAllocationAmount(
      amount.toFixed(2)
    );
  }

  async function handleSubmit(
    event: React.FormEvent
  ) {
    event.preventDefault();

    setMessage("");

    if (!invoiceId) {
      setMessage(
        "Please select an invoice."
      );
      return;
    }

    if (
      !Number.isFinite(allocationNumber) ||
      allocationNumber <= 0
    ) {
      setMessage(
        "Enter a valid allocation amount."
      );
      return;
    }

    if (allocationIsTooHigh) {
      setMessage(
        "Allocation cannot exceed the available credit or invoice balance."
      );
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "/api/reconciliation/apply-credit",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            paymentId,
            invoiceId,
            allocationAmount:
              allocationNumber,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.message ||
            "Unable to apply customer credit."
        );
        return;
      }

      setMessage(
        data.message ||
          "Customer credit applied successfully."
      );

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
    <div className="mt-4 border-t border-slate-800 pt-4">
      <p className="text-sm font-medium text-white">
        Apply Credit to Invoice
      </p>

      <p className="mt-1 text-xs text-slate-400">
        Apply {customerName}&apos;s available
        credit of ₹
        {availableCredit.toLocaleString(
          "en-IN"
        )} to an open invoice.
      </p>

      {invoices.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          No open invoices available.
        </p>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="mt-4 space-y-3"
        >
          <select
            value={invoiceId}
            onChange={(event) =>
              handleInvoiceChange(
                event.target.value
              )
            }
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-amber-400"
          >
            <option value="">
              Select invoice
            </option>

            {invoices.map((invoice) => (
              <option
                key={invoice.id}
                value={invoice.id}
              >
                {invoice.invoiceNumber} -{" "}
                {invoice.customerName} -
                Balance ₹
                {invoice.balance.toLocaleString(
                  "en-IN"
                )}
              </option>
            ))}
          </select>

          <input
            type="number"
            min="0.01"
            step="0.01"
            value={allocationAmount}
            onChange={(event) =>
              setAllocationAmount(
                event.target.value
              )
            }
            placeholder="Allocation amount"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-amber-400"
          />

          {selectedInvoice && (
            <div className="grid gap-2 rounded-lg border border-slate-800 bg-slate-900 p-3 text-xs sm:grid-cols-2">
              <div>
                <p className="text-slate-500">
                  Available Credit
                </p>

                <p className="mt-1 font-semibold text-amber-400">
                  ₹
                  {availableCredit.toLocaleString(
                    "en-IN"
                  )}
                </p>
              </div>

              <div>
                <p className="text-slate-500">
                  Applying
                </p>

                <p className="mt-1 font-semibold">
                  ₹
                  {allocationNumber.toLocaleString(
                    "en-IN"
                  )}
                </p>
              </div>

              <div>
                <p className="text-slate-500">
                  Remaining Credit
                </p>

                <p className="mt-1 font-semibold">
                  ₹
                  {remainingCredit.toLocaleString(
                    "en-IN"
                  )}
                </p>
              </div>

              <div>
                <p className="text-slate-500">
                  Invoice Balance After
                </p>

                <p className="mt-1 font-semibold">
                  ₹
                  {invoiceBalanceAfter.toLocaleString(
                    "en-IN"
                  )}
                </p>
              </div>
            </div>
          )}

          {allocationIsTooHigh && (
            <p className="text-xs text-red-400">
              Allocation cannot exceed the
              available credit or invoice
              balance.
            </p>
          )}

          {message && (
            <p className="text-sm text-slate-300">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={
              loading ||
              !invoiceId ||
              allocationNumber <= 0 ||
              allocationIsTooHigh
            }
            className="w-full rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Applying..."
              : "Apply Credit"}
          </button>
        </form>
      )}
    </div>
  );
}