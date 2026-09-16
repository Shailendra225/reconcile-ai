import type { Metadata } from "next";
import "./globals.css";

import Sidebar from "@/components/Sidebar";
import { getCurrentMembership } from "@/lib/getCurrentMembership";

export const metadata: Metadata = {
  title: "Reconcile AI",
  description: "Payment reconciliation dashboard",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const membership = await getCurrentMembership();

  return (
    <html lang="en">
      <body className="bg-slate-950 text-white">
        {membership ? (
          <>
            <Sidebar
              businessName={membership.business.name}
              role={membership.role}
            />

            <div className="ml-64 min-h-screen">
              {children}
            </div>
          </>
        ) : (
          <div className="min-h-screen">
            {children}
          </div>
        )}
      </body>
    </html>
  );
}