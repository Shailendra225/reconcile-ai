import { redirect } from "next/navigation";

import { getCurrentMembership } from "@/lib/getCurrentMembership";
import { canManageBusiness } from "@/lib/permissions";
import { getPlanLimits } from "@/lib/plans";
import { db } from "@/lib/db";

import BusinessSettingsForm from "@/components/BusinessSettingsForm";
import UpgradePlanButton from "@/components/UpgradePlanButton";

export default async function SettingsPage() {
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
  // OWNER / ADMIN only
  // --------------------------------------------------

  if (
    !canManageBusiness(
      membership.role
    )
  ) {
    redirect("/dashboard");
  }

  const business =
    membership.business;

  // --------------------------------------------------
  // Subscription
  // --------------------------------------------------

  const subscription =
    await db.subscription.findUnique({
      where: {
        businessId:
          business.id,
      },
    });

  if (!subscription) {
    redirect("/dashboard");
  }

  const limits =
    getPlanLimits(
      subscription.plan
    );

  // --------------------------------------------------
  // Current month
  // --------------------------------------------------

  const now = new Date();

  const monthStart =
    new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        1
      )
    );

  const nextMonthStart =
    new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth() + 1,
        1
      )
    );

  // --------------------------------------------------
  // Usage
  // --------------------------------------------------

  const [
    monthlyTransactions,
    teamMembers,
    pendingInvitations,
  ] = await Promise.all([
    db.bankTransaction.count({
      where: {
        businessId:
          business.id,

        createdAt: {
          gte:
            monthStart,

          lt:
            nextMonthStart,
        },
      },
    }),

    db.businessMember.count({
      where: {
        businessId:
          business.id,
      },
    }),

    db.teamInvitation.count({
      where: {
        businessId:
          business.id,

        status:
          "PENDING",

        expiresAt: {
          gt: now,
        },
      },
    }),
  ]);

  const usedTeamSlots =
    teamMembers +
    pendingInvitations;

  const transactionPercentage =
    Math.min(
      (
        monthlyTransactions /
        limits.monthlyTransactions
      ) * 100,
      100
    );

  const teamPercentage =
    Math.min(
      (
        usedTeamSlots /
        limits.teamMembers
      ) * 100,
      100
    );

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-4xl">

        {/* ------------------------------------------ */}
        {/* Header */}
        {/* ------------------------------------------ */}

        <div className="mb-8">
          <h1 className="text-3xl font-bold">
            Business Settings
          </h1>

          <p className="mt-2 text-slate-400">
            Manage your business profile,
            subscription and usage.
          </p>
        </div>

        {/* ------------------------------------------ */}
        {/* Current Plan & Usage */}
        {/* ------------------------------------------ */}

        <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <p className="text-sm font-medium text-slate-400">
                Current Plan
              </p>

              <div className="mt-1 flex items-center gap-3">

                <h2 className="text-2xl font-bold">
                  {subscription.plan}
                </h2>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    subscription.status ===
                    "ACTIVE"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-red-500/10 text-red-400"
                  }`}
                >
                  {subscription.status}
                </span>

              </div>
            </div>

            <div className="text-sm text-slate-400">
              {subscription.plan ===
              "FREE"
                ? "Free plan"
                : subscription.plan ===
                    "STARTER"
                  ? "₹199 / month"
                  : "₹299 / month"}
            </div>

          </div>

          {/* ---------------------------------------- */}
          {/* Usage */}
          {/* ---------------------------------------- */}

          <div className="mt-8 grid gap-5 md:grid-cols-2">

            {/* Monthly transactions */}

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">

              <div className="flex items-center justify-between gap-4">

                <div>
                  <p className="text-sm text-slate-400">
                    Monthly Transactions
                  </p>

                  <p className="mt-1 text-xl font-semibold">
                    {monthlyTransactions.toLocaleString()}
                    {" / "}
                    {limits.monthlyTransactions.toLocaleString()}
                  </p>
                </div>

                <p className="text-sm text-slate-400">
                  {Math.max(
                    limits.monthlyTransactions -
                      monthlyTransactions,
                    0
                  ).toLocaleString()}{" "}
                  left
                </p>

              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">

                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{
                    width: `${transactionPercentage}%`,
                  }}
                />

              </div>

              <p className="mt-3 text-xs text-slate-500">
                Resets at the beginning of
                each calendar month.
              </p>

            </div>

            {/* Team usage */}

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">

              <div className="flex items-center justify-between gap-4">

                <div>
                  <p className="text-sm text-slate-400">
                    Team Members
                  </p>

                  <p className="mt-1 text-xl font-semibold">
                    {usedTeamSlots}
                    {" / "}
                    {limits.teamMembers}
                  </p>
                </div>

                <p className="text-sm text-slate-400">
                  {Math.max(
                    limits.teamMembers -
                      usedTeamSlots,
                    0
                  )}{" "}
                  left
                </p>

              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">

                <div
                  className="h-full rounded-full bg-violet-500 transition-all"
                  style={{
                    width: `${teamPercentage}%`,
                  }}
                />

              </div>

              <p className="mt-3 text-xs text-slate-500">
                Includes active members and
                valid pending invitations.
              </p>

            </div>

          </div>
        </section>

        {/* ------------------------------------------ */}
        {/* Plans */}
        {/* ------------------------------------------ */}

        <section className="mb-8">

          <div className="mb-5">

            <h2 className="text-2xl font-bold">
              Plans
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Choose a plan based on your
              monthly reconciliation needs.
            </p>

          </div>

          <div className="grid gap-5 md:grid-cols-3">

            {/* -------------------------------------- */}
            {/* FREE */}
            {/* -------------------------------------- */}

            <div
              className={`rounded-2xl border p-6 ${
                subscription.plan ===
                "FREE"
                  ? "border-blue-500 bg-blue-500/5"
                  : "border-slate-800 bg-slate-900"
              }`}
            >

              <div className="flex items-center justify-between gap-3">

                <h3 className="text-xl font-bold">
                  FREE
                </h3>

                {subscription.plan ===
                  "FREE" && (
                  <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-400">
                    Current
                  </span>
                )}

              </div>

              <div className="mt-4">

                <span className="text-3xl font-bold">
                  ₹0
                </span>

                <span className="text-sm text-slate-400">
                  {" "}
                  / month
                </span>

              </div>

              <div className="mt-6 space-y-3 text-sm text-slate-300">

                <p>
                  ✓ 100 transactions / month
                </p>

                <p>
                  ✓ 1 team member
                </p>

                <p>
                  ✓ Payment reconciliation
                </p>

              </div>

              <div className="mt-7">

                {subscription.plan ===
                "FREE" ? (
                  <button
                    type="button"
                    disabled
                    className="w-full cursor-not-allowed rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-400"
                  >
                    Current Plan
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    title="Plan downgrade will be added separately."
                    className="w-full cursor-not-allowed rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-500 opacity-60"
                  >
                    Downgrade
                  </button>
                )}

              </div>

            </div>

            {/* -------------------------------------- */}
            {/* STARTER */}
            {/* -------------------------------------- */}

            <div
              className={`rounded-2xl border p-6 ${
                subscription.plan ===
                "STARTER"
                  ? "border-blue-500 bg-blue-500/5"
                  : "border-slate-800 bg-slate-900"
              }`}
            >

              <div className="flex items-center justify-between gap-3">

                <h3 className="text-xl font-bold">
                  STARTER
                </h3>

                {subscription.plan ===
                  "STARTER" && (
                  <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-400">
                    Current
                  </span>
                )}

              </div>

              <div className="mt-4">

                <span className="text-3xl font-bold">
                  ₹199
                </span>

                <span className="text-sm text-slate-400">
                  {" "}
                  / month
                </span>

              </div>

              <div className="mt-6 space-y-3 text-sm text-slate-300">

                <p>
                  ✓ 1,000 transactions / month
                </p>

                <p>
                  ✓ 3 team members
                </p>

                <p>
                  ✓ Payment reconciliation
                </p>

              </div>

              <div className="mt-7">

                {subscription.plan ===
                "STARTER" ? (
                  <button
                    type="button"
                    disabled
                    className="w-full cursor-not-allowed rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-400"
                  >
                    Current Plan
                  </button>
                ) : subscription.plan ===
                  "FREE" ? (
                  <UpgradePlanButton
                    plan="STARTER"
                    price={199}
                    businessName={
                      business.name
                    }
                    email={
                      business.email ??
                      ""
                    }
                  />
                ) : (
                  <button
                    type="button"
                    disabled
                    title="Plan downgrade will be added separately."
                    className="w-full cursor-not-allowed rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-500 opacity-60"
                  >
                    Downgrade
                  </button>
                )}

              </div>

            </div>

            {/* -------------------------------------- */}
            {/* PRO */}
            {/* -------------------------------------- */}

            <div
              className={`rounded-2xl border p-6 ${
                subscription.plan ===
                "PRO"
                  ? "border-violet-500 bg-violet-500/5"
                  : "border-slate-800 bg-slate-900"
              }`}
            >

              <div className="flex items-center justify-between gap-3">

                <h3 className="text-xl font-bold">
                  PRO
                </h3>

                {subscription.plan ===
                  "PRO" && (
                  <span className="rounded-full bg-violet-500/10 px-2.5 py-1 text-xs font-semibold text-violet-400">
                    Current
                  </span>
                )}

              </div>

              <div className="mt-4">

                <span className="text-3xl font-bold">
                  ₹299
                </span>

                <span className="text-sm text-slate-400">
                  {" "}
                  / month
                </span>

              </div>

              <div className="mt-6 space-y-3 text-sm text-slate-300">

                <p>
                  ✓ 10,000 transactions / month
                </p>

                <p>
                  ✓ 10 team members
                </p>

                <p>
                  ✓ Payment reconciliation
                </p>

              </div>

              <div className="mt-7">

                {subscription.plan ===
                "PRO" ? (
                  <button
                    type="button"
                    disabled
                    className="w-full cursor-not-allowed rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-400"
                  >
                    Current Plan
                  </button>
                ) : (
                  <UpgradePlanButton
                    plan="PRO"
                    price={299}
                    businessName={
                      business.name
                    }
                    email={
                      business.email ??
                      ""
                    }
                  />
                )}

              </div>

            </div>

          </div>

          <p className="mt-4 text-xs text-slate-500">
            Paid subscriptions are processed
            securely through Razorpay.
          </p>

        </section>

        {/* ------------------------------------------ */}
        {/* Business profile */}
        {/* ------------------------------------------ */}

        <BusinessSettingsForm
          business={{
            name:
              business.name,

            email:
              business.email ??
              "",

            phone:
              business.phone ??
              "",

            currency:
              business.currency,

            address:
              business.address ??
              "",

            city:
              business.city ??
              "",

            state:
              business.state ??
              "",

            pincode:
              business.pincode ??
              "",

            gstin:
              business.gstin ??
              "",
          }}
        />

      </div>
    </main>
  );
}