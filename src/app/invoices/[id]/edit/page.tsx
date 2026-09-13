import {
  notFound,
  redirect,
} from "next/navigation";

import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/getCurrentBusiness";
import EditInvoiceForm from "@/components/EditInvoiceForm";

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const business =
    await getCurrentBusiness();

  if (!business) {
    redirect("/login");
  }

  const { id } = await params;

  const invoice =
    await db.invoice.findFirst({
      where: {
        id,
        businessId:
          business.id,
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