"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const token = searchParams.get("token");
  const errorParam = searchParams.get("error");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (!token) {
      setError(
        "Invalid or expired password reset link."
      );
      return;
    }

    if (password.length < 8) {
      setError(
        "Password must be at least 8 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const { error } =
        await authClient.resetPassword({
          newPassword: password,
          token,
        });

      if (error) {
        setError(
          error.message ||
            "Unable to reset password."
        );
        return;
      }

      setSuccess(
        "Password reset successfully. Redirecting to login..."
      );

      setPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        router.push("/login");
      }, 1500);
    } catch (err) {
      console.error(
        "Reset password error:",
        err
      );

      setError(
        "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  if (errorParam || !token) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-xl">
          <h1 className="text-2xl font-bold text-white">
            Invalid Reset Link
          </h1>

          <p className="mt-3 text-sm text-slate-400">
            This password reset link is invalid or
            has expired.
          </p>

          <Link
            href="/forgot-password"
            className="mt-6 inline-block rounded-lg bg-cyan-600 px-5 py-3 font-semibold text-white transition hover:bg-cyan-500"
          >
            Request New Reset Link
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">

        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white">
            Reset Password
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Enter your new Reconcile AI password.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5"
        >
          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium text-slate-200"
            >
              New Password
            </label>

            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              autoComplete="new-password"
              placeholder="Minimum 8 characters"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-500"
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-2 block text-sm font-medium text-slate-200"
            >
              Confirm New Password
            </label>

            <input
              id="confirmPassword"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) =>
                setConfirmPassword(
                  e.target.value
                )
              }
              autoComplete="new-password"
              placeholder="Enter password again"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-500"
            />
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

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-cyan-600 px-4 py-3 font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? "Resetting..."
              : "Reset Password"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="text-sm font-medium text-cyan-400 hover:text-cyan-300"
          >
            ← Back to Login
          </Link>
        </div>

      </div>
    </main>
  );
}