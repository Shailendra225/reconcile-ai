"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ConfirmMatchButton({
  matchId,
}: {
  matchId: string;
}) {
  const router = useRouter();

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  async function confirmMatch() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/reconciliation/${matchId}/confirm`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to confirm match"
        );
      }

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
        onClick={confirmMatch}
        disabled={loading}
        className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading
          ? "Confirming..."
          : "Confirm Match"}
      </button>

      {error && (
        <p className="mt-2 max-w-48 text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}