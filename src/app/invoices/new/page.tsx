import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/getCurrentBusiness";
import NewInvoiceForm from "@/components/NewInvoiceForm";

export default async function NewInvoicePage() {
  const business =
    await getCurrentBusiness();

  if (!business) {
    redirect("/login");
  }

  const customers =
    await db.customer.findMany({
      where: {
        businessId:
          business.id,
      },

      orderBy: {
        name: "asc",
      },

      select: {
        id: true,
        name: true,
      },
    });

  return (
    <main className="min-h-screen bg-slate-950 px-8 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-medium text-cyan-400">
          Reconcile AI
        </p>

        <h1 className="mt-2 text-3xl font-bold">
          Create Invoice
        </h1>

        <p className="mt-2 text-sm text-slate-400">
          Create a new invoice for a customer.
        </p>

        <div className="mt-8">
          <NewInvoiceForm
            customers={customers}
          />
        </div>
      </div>
    </main>
  );
}