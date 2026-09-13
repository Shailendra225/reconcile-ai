"use client";

import { FormEvent, useState } from "react";

export default function CsvImportForm() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setMessage("");
    setError("");

    if (!file) {
      setError("Please select a CSV file.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();

      formData.append("file", file);

      const response = await fetch(
        "/api/imports/csv",
        {
          method: "POST",
          body: formData,
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
          data.message || "CSV import failed"
        );
      }

      const suggested =
  data.reconciliation?.suggested ?? 0;

const scanned =
  data.reconciliation?.scanned ?? 0;

setMessage(
  `${data.imported} transaction${
    data.imported === 1 ? "" : "s"
  } imported. ${data.duplicates} duplicate${
    data.duplicates === 1 ? "" : "s"
  } skipped. ${suggested} match${
    suggested === 1 ? "" : "es"
  } suggested from ${scanned} scanned transaction${
    scanned === 1 ? "" : "s"
  }.`
);

      setFile(null);
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
      className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
    >
      <h2 className="text-lg font-semibold">
        Upload CSV
      </h2>

      <p className="mt-2 text-sm text-slate-400">
        Select a bank statement exported as a CSV file.
      </p>

      {error && (
        <div className="mt-5 rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {message && (
        <div className="mt-5 rounded-lg border border-emerald-900 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300">
          {message}
        </div>
      )}

      <label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-950 px-6 py-12 transition hover:border-cyan-400">
        <span className="text-sm font-medium">
          {file
            ? file.name
            : "Choose bank statement CSV"}
        </span>

        <span className="mt-2 text-xs text-slate-500">
          CSV files only
        </span>

        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(event) =>
            setFile(
              event.target.files?.[0] ?? null
            )
          }
        />
      </label>

      <button
        type="submit"
        disabled={!file || loading}
        className="mt-6 w-full rounded-lg bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading
          ? "Importing..."
          : "Import Transactions"}
      </button>
    </form>
  );
}