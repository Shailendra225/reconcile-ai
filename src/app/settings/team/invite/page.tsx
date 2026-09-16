import { redirect } from "next/navigation";

import { getCurrentMembership } from "@/lib/getCurrentMembership";
import { canManageTeam } from "@/lib/permissions";
import InviteTeamMemberForm from "@/components/InviteTeamMemberForm";

export default async function InviteTeamMemberPage() {
  const membership = await getCurrentMembership();

  if (!membership) {
    redirect("/login");
  }

  if (!canManageTeam(membership.role)) {
    redirect("/dashboard");
  }

  return <InviteTeamMemberForm />;
}