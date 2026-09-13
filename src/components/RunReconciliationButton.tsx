"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RunReconciliationButton() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function runReconciliation() {
    try {
      setLoading(true);
      setMessage("");
      setError("");

      const response = await fetch(
        "/api/reconciliation/run",
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to run reconciliation"
        );
      }

      setMessage(
        `Scanned ${data.scanned} transactions. ${data.suggested} suggested, ${data.noMatch} unmatched.`
      );

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
    <div>
      <button
        type="button"
        onClick={runReconciliation}
        disabled={loading}
        className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading
          ? "Running..."
          : "Run Reconciliation"}
      </button>

      {message && (
        <p className="mt-2 text-xs text-emerald-400">
          {message}
        </p>
      )}

      {error && (
        <p className="mt-2 text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}