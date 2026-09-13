"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type RejectMatchButtonProps = {
  matchId: string;
};

export default function RejectMatchButton({
  matchId,
}: RejectMatchButtonProps) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleReject() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/reconciliation/${matchId}/reject`,
        {
          method: "POST",
        }
      );

      const responseText = await response.text();

      let data;

      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(
          responseText || "Server returned an invalid response"
        );
      }

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to reject match"
        );
      }

      router.refresh();
    } catch (error) {
      console.error("REJECT MATCH ERROR:", error);

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
    <div className="w-full">
      <button
        type="button"
        onClick={handleReject}
        disabled={loading}
        className="w-full rounded-lg border border-red-500/50 px-4 py-2 text-sm font-semibold text-red-400 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Rejecting..." : "Reject Match"}
      </button>

      {error && (
        <p className="mt-2 text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}