import Link from "next/link";

const navigation = [
  { name: "Dashboard", href: "/" },
  { name: "Invoices", href: "/invoices" },
  { name: "Customers", href: "/customers" },
  { name: "Transactions", href: "/transactions" },
  { name: "Reconciliation", href: "/reconciliation" },
  { name: "Imports", href: "/imports" },
  { name: "Settings", href: "/settings" },
];

export default function Sidebar() {
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
        {navigation.map((item) => (
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
          <p className="text-sm font-medium text-white">
            Demo Business
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Free Plan
          </p>
        </div>
      </div>
    </aside>
  );
}