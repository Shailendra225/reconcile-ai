import Link from "next/link";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getCurrentMembership } from "@/lib/getCurrentMembership";
import { canManageTeam } from "@/lib/permissions";

export default async function TeamSettingsPage() {
  const membership = await getCurrentMembership();

  if (!membership) {
    redirect("/login");
  }

  // Only OWNER and ADMIN can access Team Settings
  if (!canManageTeam(membership.role)) {
    redirect("/dashboard");
  }

  const members = await db.businessMember.findMany({
    where: {
      businessId: membership.businessId,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/settings"
              className="mb-3 inline-block text-sm text-cyan-400 hover:text-cyan-300"
            >
              ← Business Settings
            </Link>

            <h1 className="text-3xl font-bold">
              Team Members
            </h1>

            <p className="mt-2 text-slate-400">
              Manage people who have access to{" "}
              {membership.business.name}.
            </p>
          </div>

          <Link
            href="/settings/team/invite"
            className="inline-flex items-center justify-center rounded-lg bg-cyan-600 px-5 py-3 font-semibold text-white transition hover:bg-cyan-500"
          >
            + Invite Member
          </Link>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl">
          <div className="border-b border-slate-800 px-6 py-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  Members
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  {members.length}{" "}
                  {members.length === 1
                    ? "member"
                    : "members"}
                </p>
              </div>

              <div className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-400">
                Your role: {membership.role}
              </div>
            </div>
          </div>

          {members.length === 0 ? (
            <div className="px-6 py-12 text-center text-slate-400">
              No team members found.
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 font-bold text-cyan-400">
                      {member.user.name
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-white">
                          {member.user.name}
                        </p>

                        {member.userId ===
                          membership.userId && (
                          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                            You
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-sm text-slate-400">
                        {member.user.email}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Joined{" "}
                        {member.createdAt.toLocaleDateString(
                          "en-IN",
                          {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          }
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-400">
                      {member.role}
                    </span>

                    {member.user.emailVerified ? (
                      <span className="text-xs text-emerald-400">
                        Verified
                      </span>
                    ) : (
                      <span className="text-xs text-amber-400">
                        Unverified
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <h3 className="font-semibold">
            Role permissions
          </h3>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            OWNER has full business control. ADMIN can
            manage the team and operations. ACCOUNTANT
            handles invoices, payments and reconciliation.
            VIEWER has read-only access.
          </p>
        </div>
      </div>
    </main>
  );
}