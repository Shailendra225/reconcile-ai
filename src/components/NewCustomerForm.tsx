"use client";

import { FormEvent, useState } from "react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";

export default function NewCustomerForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const returnTo =
    searchParams.get("returnTo") || "/customers";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [upiId, setUpiId] = useState("");
  const [gstNumber, setGstNumber] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await fetch(
        "/api/customer",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            name,
            email: email || null,
            phone: phone || null,
            upiId: upiId || null,
            gstNumber: gstNumber || null,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to create customer"
        );
      }

      const separator =
        returnTo.includes("?")
          ? "&"
          : "?";

      router.push(
        `${returnTo}${separator}customerId=${encodeURIComponent(
          data.customer.id
        )}`
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
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900 p-6"
    >
      {error && (
        <div className="rounded-lg border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <Field
        label="Customer Name"
        value={name}
        onChange={setName}
        required
        placeholder="ABC Traders"
      />

      <Field
        label="Email"
        value={email}
        onChange={setEmail}
        type="email"
        placeholder="contact@example.com"
      />

      <Field
        label="Phone"
        value={phone}
        onChange={setPhone}
        placeholder="9876543210"
      />

      <Field
        label="UPI ID"
        value={upiId}
        onChange={setUpiId}
        placeholder="abc@upi"
      />

      <Field
        label="GST Number"
        value={gstNumber}
        onChange={setGstNumber}
        placeholder="23ABCDE1234F1Z5"
      />

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading
          ? "Creating..."
          : "Create Customer"}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm text-slate-300">
        {label}
      </label>

      <input
        type={type}
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        placeholder={placeholder}
        required={required}
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
      />
    </div>
  );
}