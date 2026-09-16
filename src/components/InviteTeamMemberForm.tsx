"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

export default function InviteTeamMemberForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("ACCOUNTANT");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);
    setSuccess("");
    setError("");

    try {
      const response = await fetch("/api/team/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.message || "Unable to send invitation."
        );
        return;
      }

      setSuccess(
        data.message || "Invitation sent successfully."
      );

      setEmail("");
      setRole("ACCOUNTANT");
    } catch (err) {
      console.error("Invite member error:", err);

      setError(
        "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/settings/team"
          className="mb-5 inline-block text-sm text-cyan-400 hover:text-cyan-300"
        >
          ← Team Members
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold">
            Invite Team Member
          </h1>

          <p className="mt-2 text-slate-400">
            Invite an accountant or team member to your
            Reconcile AI workspace.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl sm:p-8"
        >
          <div className="space-y-6">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-slate-200"
              >
                Email Address
              </label>

              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="accountant@example.com"
                autoComplete="email"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-500"
              />

              <p className="mt-2 text-xs text-slate-500">
                We&apos;ll send an invitation to this
                email address.
              </p>
            </div>

            <div>
              <label
                htmlFor="role"
                className="mb-2 block text-sm font-medium text-slate-200"
              >
                Role
              </label>

              <select
                id="role"
                value={role}
                onChange={(event) =>
                  setRole(event.target.value)
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-500"
              >
                <option value="ADMIN">
                  ADMIN
                </option>

                <option value="ACCOUNTANT">
                  ACCOUNTANT
                </option>

                <option value="VIEWER">
                  VIEWER
                </option>
              </select>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-sm font-medium text-white">
                Role permissions
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                ADMIN can manage the team and operations.
                ACCOUNTANT can work with invoices,
                payments and reconciliation. VIEWER will
                have read-only access.
              </p>
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
                {success}
              </div>
            )}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Link
                href="/settings/team"
                className="rounded-lg border border-slate-700 px-5 py-3 text-center font-medium text-slate-300 transition hover:bg-slate-800"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-cyan-600 px-6 py-3 font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? "Sending Invitation..."
                  : "Send Invitation"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}