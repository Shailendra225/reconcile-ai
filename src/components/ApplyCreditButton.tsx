"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CreditSource = {
  paymentId: string;
  availableAmount: number;
};

type ApplyCreditButtonProps = {
  invoiceId: string;
  balanceDue: number;
  creditSources: CreditSource[];
};

export default function ApplyCreditButton({
  invoiceId,
  balanceDue,
  creditSources,
}: ApplyCreditButtonProps) {
  const router = useRouter();
  const [isApplying, setIsApplying] =
    useState(false);
  const [message, setMessage] =
    useState<string | null>(null);
  const [isError, setIsError] =
    useState(false);

  const totalAvailableCredit =
    creditSources.reduce(
      (total, source) =>
        total +
        source.availableAmount,
      0
    );

  const amountToApply =
    Math.min(
      balanceDue,
      totalAvailableCredit
    );

  async function handleApplyCredit() {
    if (
      isApplying ||
      amountToApply <= 0
    ) {
      return;
    }

    setIsApplying(true);
    setMessage(null);
    setIsError(false);

    let remainingBalance =
      balanceDue;
    let appliedTotal = 0;

    try {
      for (const source of creditSources) {
        if (
          remainingBalance <= 0.01
        ) {
          break;
        }

        const allocationAmount =
          Math.min(
            source.availableAmount,
            remainingBalance
          );

        if (
          allocationAmount <= 0.01
        ) {
          continue;
        }

        const response =
          await fetch(
            "/api/reconciliation/apply-credit",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                paymentId:
                  source.paymentId,
                invoiceId,
                allocationAmount,
              }),
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Failed to apply customer credit."
          );
        }

        appliedTotal +=
          allocationAmount;

        remainingBalance =
          Math.max(
            remainingBalance -
              allocationAmount,
            0
          );
      }

      setMessage(
        `₹${appliedTotal.toLocaleString(
          "en-IN",
          {
            maximumFractionDigits: 2,
          }
        )} credit applied successfully.`
      );

      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to apply customer credit."
      );

      router.refresh();
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <div className="min-w-[220px]">
      <button
        type="button"
        onClick={handleApplyCredit}
        disabled={
          isApplying ||
          amountToApply <= 0
        }
        className="w-full rounded-lg bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isApplying
          ? "Applying Credit..."
          : `Apply ₹${amountToApply.toLocaleString(
              "en-IN",
              {
                maximumFractionDigits: 2,
              }
            )} Credit`}
      </button>

      {message && (
        <p
          className={`mt-2 text-sm ${
            isError
              ? "text-red-400"
              : "text-emerald-400"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
