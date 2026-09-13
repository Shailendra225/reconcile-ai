import { redirect } from "next/navigation";

import NewCustomerForm from "@/components/NewCustomerForm";
import { getCurrentBusiness } from "@/lib/getCurrentBusiness";

export default async function NewCustomerPage() {
  const business =
    await getCurrentBusiness();

  if (!business) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-8 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-medium text-cyan-400">
          Reconcile AI
        </p>

        <h1 className="mt-2 text-3xl font-bold">
          New Customer
        </h1>

        <p className="mt-2 text-sm text-slate-400">
          Add a new customer to your business.
        </p>

        <div className="mt-8">
          <NewCustomerForm />
        </div>
      </div>
    </main>
  );
}