import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Reconcile AI",
  description: "Payment reconciliation dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-white">
        <Sidebar />

        <div className="ml-64 min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}