"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function AcceptInvitationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const token = searchParams.get("token");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError(
        "Invalid invitation link. Invitation token is missing."
      );
    }
  }, [token]);

  async function acceptInvitation() {
    if (!token) {
      setError("Invitation token is missing.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        "/api/team/invite/accept",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (data.code === "LOGIN_REQUIRED") {
          setError(
            "Please log in with the email address that received this invitation."
          );

          setTimeout(() => {
            router.push(
              `/login?invite=${encodeURIComponent(
                token
              )}`
            );
          }, 1500);

          return;
        }

        if (data.code === "EMAIL_MISMATCH") {
          setError(
            data.message ||
              "Please log in using the invited email address."
          );

          return;
        }

        setError(
          data.message ||
            "Unable to accept invitation."
        );

        return;
      }

      setMessage(
        data.message ||
          "Invitation accepted successfully."
      );

      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 1500);
    } catch (error) {
      console.error(
        "ACCEPT INVITATION ERROR:",
        error
      );

      setError(
        "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto max-w-lg">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-100 text-xl">
              👥
            </div>

            <h1 className="text-2xl font-bold text-slate-900">
              Team Invitation
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              You have been invited to join a Reconcile AI
              business workspace.
            </p>
          </div>

          {message && (
            <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {message}
            </div>
          )}

          {error && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-600">
              To accept this invitation, you must be logged
              in using the same email address where the
              invitation was received.
            </p>
          </div>

          <button
            type="button"
            onClick={acceptInvitation}
            disabled={
              loading ||
              !token ||
              Boolean(message)
            }
            className="mt-6 w-full rounded-lg bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Accepting..."
              : message
                ? "Invitation Accepted"
                : "Accept Invitation"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/login")}
            className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Go to Login
          </button>
        </div>
      </div>
    </main>
  );
}