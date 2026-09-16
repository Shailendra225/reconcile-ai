import {
  notFound,
  redirect,
} from "next/navigation";

import { db } from "@/lib/db";
import { getCurrentMembership } from "@/lib/getCurrentMembership";
import { canManageInvoices } from "@/lib/permissions";
import EditInvoiceForm from "@/components/EditInvoiceForm";

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
  // VIEWER cannot access invoice edit page
  // --------------------------------------------------

  if (
    !canManageInvoices(
      membership.role
    )
  ) {
    redirect("/invoices");
  }

  const { id } = await params;

  // --------------------------------------------------
  // Fetch invoice from current workspace only
  // --------------------------------------------------

  const invoice =
    await db.invoice.findFirst({
      where: {
        id,
        businessId:
          membership.businessId,
      },
    });

  if (!invoice) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-950 px-8 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-medium text-cyan-400">
          Reconcile AI
        </p>

        <h1 className="mt-2 text-3xl font-bold">
          Edit Invoice
        </h1>

        <p className="mt-2 text-sm text-slate-400">
          Update invoice details.
        </p>

        <div className="mt-8">
          <EditInvoiceForm
            invoice={{
              id: invoice.id,

              invoiceNumber:
                invoice.invoiceNumber,

              totalAmount:
                Number(
                  invoice.totalAmount
                ),

              dueDate:
                invoice.dueDate
                  ? invoice.dueDate
                      .toISOString()
                      .split("T")[0]
                  : "",

              notes:
                invoice.notes ??
                "",
            }}
          />
        </div>
      </div>
    </main>
  );
}