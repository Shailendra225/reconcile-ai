import type { BusinessRole } from "@/generated/prisma/client";

export type Permission =
  | "manage_business"
  | "manage_team"
  | "manage_invoices"
  | "manage_customers"
  | "manage_transactions"
  | "manage_reconciliation"
  | "view_data";

const rolePermissions: Record<
  BusinessRole,
  Permission[]
> = {
  OWNER: [
    "manage_business",
    "manage_team",
    "manage_invoices",
    "manage_customers",
    "manage_transactions",
    "manage_reconciliation",
    "view_data",
  ],

  ADMIN: [
    "manage_business",
    "manage_team",
    "manage_invoices",
    "manage_customers",
    "manage_transactions",
    "manage_reconciliation",
    "view_data",
  ],

  ACCOUNTANT: [
    "manage_invoices",
    "manage_customers",
    "manage_transactions",
    "manage_reconciliation",
    "view_data",
  ],

  VIEWER: [
    "view_data",
  ],
};

export function hasPermission(
  role: BusinessRole,
  permission: Permission
) {
  return rolePermissions[role].includes(permission);
}

export function canManageTeam(
  role: BusinessRole
) {
  return hasPermission(role, "manage_team");
}

export function canManageBusiness(
  role: BusinessRole
) {
  return hasPermission(role, "manage_business");
}

export function canManageInvoices(
  role: BusinessRole
) {
  return hasPermission(role, "manage_invoices");
}

export function canManageCustomers(
  role: BusinessRole
) {
  return hasPermission(role, "manage_customers");
}

export function canManageTransactions(
  role: BusinessRole
) {
  return hasPermission(
    role,
    "manage_transactions"
  );
}

export function canManageReconciliation(
  role: BusinessRole
) {
  return hasPermission(
    role,
    "manage_reconciliation"
  );
}