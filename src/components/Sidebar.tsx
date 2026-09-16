import Link from "next/link";

import type { BusinessRole } from "@/generated/prisma/client";
import {
  canManageBusiness,
  canManageTransactions,
} from "@/lib/permissions";

type SidebarProps = {
  businessName: string;
  role: BusinessRole;
};

export default function Sidebar({
  businessName,
  role,
}: SidebarProps) {
  const navigation = [
    {
      name: "Dashboard",
      href: "/",
      visible: true,
    },
    {
      name: "Invoices",
      href: "/invoices",
      visible: true,
    },
    {
      name: "Customers",
      href: "/customers",
      visible: true,
    },
    {
      name: "Transactions",
      href: "/transactions",
      visible: true,
    },
    {
      name: "Reconciliation",
      href: "/reconciliation",
      visible: true,
    },
    {
      name: "Imports",
      href: "/imports",
      visible: canManageTransactions(role),
    },
    {
      name: "Settings",
      href: "/settings",
      visible: canManageBusiness(role),
    },
  ];

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 border-r border-slate-800 bg-slate-950">
      <div className="border-b border-slate-800 px-6 py-6">
        <h1 className="text-xl font-bold text-white">
          Reconcile
          <span className="text-cyan-400">AI</span>
        </h1>

        <p className="mt-1 text-xs text-slate-500">
          Payment reconciliation
        </p>
      </div>

      <nav className="space-y-1 p-4">
        {navigation
          .filter((item) => item.visible)
          .map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-lg px-4 py-3 text-sm font-medium text-slate-400 transition hover:bg-slate-900 hover:text-white"
            >
              {item.name}
            </Link>
          ))}
      </nav>

      <div className="absolute bottom-0 w-full border-t border-slate-800 p-4">
        <div className="rounded-xl bg-slate-900 p-4">
          <p className="truncate text-sm font-medium text-white">
            {businessName}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {role}
          </p>
        </div>
      </div>
    </aside>
  );
}