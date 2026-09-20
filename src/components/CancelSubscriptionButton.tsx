"use client";

import { useState } from "react";

type Props = {
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd?: string | null;
};

export default function CancelSubscriptionButton({
  cancelAtPeriodEnd,
  currentPeriodEnd,
}: Props) {
  const [loading, setLoading] = useState(false);

  async function handleCancel() {
    if (cancelAtPeriodEnd) {
      return;
    }

    const confirmed = window.confirm(
      "Cancel your subscription? You will keep access until the end of your current billing period."
    );

    if (!confirmed) {
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        "/api/billing/cancel-subscription",
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        alert(
          data.message ||
            "Unable to cancel subscription."
        );
        return;
      }

      alert(
        "Subscription cancellation scheduled successfully."
      );

      window.location.reload();
    } catch (error) {
      console.error(
        "CANCEL SUBSCRIPTION ERROR:",
        error
      );

      alert(
        "Unable to cancel subscription."
      );
    } finally {
      setLoading(false);
    }
  }

  if (cancelAtPeriodEnd) {
    return (
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
        <p className="text-sm font-semibold text-amber-400">
          Cancellation scheduled
        </p>

        <p className="mt-1 text-xs text-slate-400">
          Your subscription will remain active
          until the end of the current billing
          period.
        </p>

        {currentPeriodEnd && (
          <p className="mt-2 text-xs text-slate-500">
            Current period ends:{" "}
            {new Intl.DateTimeFormat("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              timeZone: "UTC",
            }).format(
              new Date(currentPeriodEnd)
            )}
          </p>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleCancel}
      disabled={loading}
      className="rounded-lg border border-red-500/40 px-4 py-2.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading
        ? "Scheduling cancellation..."
        : "Cancel Subscription"}
    </button>
  );
}