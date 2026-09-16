"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Business = {
  name: string;
  email: string;
  phone: string;
  currency: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  gstin: string;
};

type Props = {
  business: Business;
};

export default function BusinessSettingsForm({
  business,
}: Props) {
  const router = useRouter();

  const [form, setForm] = useState<Business>(business);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) {
    const { name, value } = e.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setLoading(true);
    setSuccess("");
    setError("");

    try {
      const response = await fetch(
        "/api/settings/business",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(form),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.message ||
            "Unable to update business settings."
        );
        return;
      }

      setSuccess(
        "Business settings updated successfully."
      );

      router.refresh();
    } catch (err) {
      console.error(
        "Business settings update error:",
        err
      );

      setError(
        "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl sm:p-8"
    >
      <div className="grid gap-6 md:grid-cols-2">

        <div>
          <label
            htmlFor="name"
            className="mb-2 block text-sm font-medium text-slate-200"
          >
            Business Name
          </label>

          <input
            id="name"
            name="name"
            type="text"
            required
            value={form.name}
            onChange={handleChange}
            placeholder="Reconcile AI Pvt Ltd"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-500"
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="mb-2 block text-sm font-medium text-slate-200"
          >
            Business Email
          </label>

          <input
            id="email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            placeholder="accounts@example.com"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-500"
          />
        </div>

        <div>
          <label
            htmlFor="phone"
            className="mb-2 block text-sm font-medium text-slate-200"
          >
            Phone Number
          </label>

          <input
            id="phone"
            name="phone"
            type="tel"
            value={form.phone}
            onChange={handleChange}
            placeholder="+91 9876543210"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-500"
          />
        </div>

        <div>
          <label
            htmlFor="currency"
            className="mb-2 block text-sm font-medium text-slate-200"
          >
            Currency
          </label>

          <select
            id="currency"
            name="currency"
            value={form.currency}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-500"
          >
            <option value="INR">
              INR — Indian Rupee
            </option>
            <option value="USD">
              USD — US Dollar
            </option>
            <option value="EUR">
              EUR — Euro
            </option>
            <option value="GBP">
              GBP — British Pound
            </option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label
            htmlFor="address"
            className="mb-2 block text-sm font-medium text-slate-200"
          >
            Business Address
          </label>

          <textarea
            id="address"
            name="address"
            rows={3}
            value={form.address}
            onChange={handleChange}
            placeholder="Office / Shop address"
            className="w-full resize-none rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-500"
          />
        </div>

        <div>
          <label
            htmlFor="city"
            className="mb-2 block text-sm font-medium text-slate-200"
          >
            City
          </label>

          <input
            id="city"
            name="city"
            type="text"
            value={form.city}
            onChange={handleChange}
            placeholder="Indore"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-500"
          />
        </div>

        <div>
          <label
            htmlFor="state"
            className="mb-2 block text-sm font-medium text-slate-200"
          >
            State
          </label>

          <input
            id="state"
            name="state"
            type="text"
            value={form.state}
            onChange={handleChange}
            placeholder="Madhya Pradesh"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-500"
          />
        </div>

        <div>
          <label
            htmlFor="pincode"
            className="mb-2 block text-sm font-medium text-slate-200"
          >
            Pincode
          </label>

          <input
            id="pincode"
            name="pincode"
            type="text"
            inputMode="numeric"
            value={form.pincode}
            onChange={handleChange}
            placeholder="452001"
            maxLength={6}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-500"
          />
        </div>

        <div>
          <label
            htmlFor="gstin"
            className="mb-2 block text-sm font-medium text-slate-200"
          >
            GSTIN
          </label>

          <input
            id="gstin"
            name="gstin"
            type="text"
            value={form.gstin}
            onChange={(e) =>
              setForm((previous) => ({
                ...previous,
                gstin: e.target.value.toUpperCase(),
              }))
            }
            placeholder="22AAAAA0000A1Z5"
            maxLength={15}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 uppercase text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-500"
          />
        </div>

      </div>

      {error && (
        <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="mt-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
          {success}
        </div>
      )}

      <div className="mt-8 flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-cyan-600 px-6 py-3 font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading
            ? "Saving..."
            : "Save Changes"}
        </button>
      </div>
    </form>
  );
}