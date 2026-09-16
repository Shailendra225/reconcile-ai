import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getCurrentMembership } from "@/lib/getCurrentMembership";
import { canManageInvoices } from "@/lib/permissions";
import NewInvoiceForm from "@/components/NewInvoiceForm";

export default async function NewInvoicePage() {
  // --------------------------------------------------
  // Current workspace membership
  // --------------------------------------------------

  const membership =
    await getCurrentMembership();

  if (!membership) {
    redirect("/login");
  }

  // --------------------------------------------------
  // Permission check
  // VIEWER cannot create invoices
  // --------------------------------------------------

  if (
    !canManageInvoices(
      membership.role
    )
  ) {
    redirect("/invoices");
  }

  // --------------------------------------------------
  // Fetch customers from current workspace only
  // --------------------------------------------------

  const customers =
    await db.customer.findMany({
      where: {
        businessId:
          membership.businessId,
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