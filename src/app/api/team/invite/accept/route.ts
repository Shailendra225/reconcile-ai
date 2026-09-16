import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { getPlanLimits } from "@/lib/plans";

export async function POST(request: Request) {
  try {
    // --------------------------------------------------
    // Current logged-in user
    // --------------------------------------------------

    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Please log in to accept this invitation.",
          code: "LOGIN_REQUIRED",
        },
        { status: 401 }
      );
    }

    // --------------------------------------------------
    // Read invitation token
    // --------------------------------------------------

    const body = await request.json();

    const token =
      typeof body.token === "string"
        ? body.token.trim()
        : "";

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invitation token is missing.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // Find invitation
    // --------------------------------------------------

    const invitation =
      await db.teamInvitation.findUnique({
        where: {
          token,
        },

        include: {
          business: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

    if (!invitation) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid invitation link.",
        },
        { status: 404 }
      );
    }

    // --------------------------------------------------
    // Invitation status
    // --------------------------------------------------

    if (
      invitation.status !== "PENDING"
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            invitation.status ===
            "ACCEPTED"
              ? "This invitation has already been accepted."
              : "This invitation is no longer valid.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // Expiry
    // --------------------------------------------------

    if (
      invitation.expiresAt.getTime() <
      Date.now()
    ) {
      await db.teamInvitation.update({
        where: {
          id: invitation.id,
        },

        data: {
          status: "EXPIRED",
        },
      });

      return NextResponse.json(
        {
          success: false,
          message:
            "This invitation has expired.",
        },
        { status: 410 }
      );
    }

    // --------------------------------------------------
    // Email ownership
    // --------------------------------------------------

    if (
      user.email
        .trim()
        .toLowerCase() !==
      invitation.email
        .trim()
        .toLowerCase()
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            `This invitation was sent to ${invitation.email}. ` +
            "Please log in using that email address.",

          code: "EMAIL_MISMATCH",
        },
        { status: 403 }
      );
    }

    // --------------------------------------------------
    // Already member of invited business
    // --------------------------------------------------

    const existingMember =
      await db.businessMember.findUnique({
        where: {
          businessId_userId: {
            businessId:
              invitation.businessId,

            userId:
              user.id,
          },
        },
      });

    if (existingMember) {
      await db.teamInvitation.update({
        where: {
          id: invitation.id,
        },

        data: {
          status: "ACCEPTED",
        },
      });

      return NextResponse.json({
        success: true,

        message:
          "You are already a member of this business.",

        businessName:
          invitation.business.name,

        role:
          existingMember.role,
      });
    }

    // --------------------------------------------------
    // One workspace per user protection
    // --------------------------------------------------

    const existingWorkspace =
      await db.businessMember.findFirst({
        where: {
          userId:
            user.id,
        },

        include: {
          business: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

    if (existingWorkspace) {
      return NextResponse.json(
        {
          success: false,

          message:
            `Your account already belongs to ${existingWorkspace.business.name}. ` +
            "Reconcile AI currently supports one business workspace per account.",

          code:
            "WORKSPACE_CONFLICT",

          currentBusinessName:
            existingWorkspace.business.name,

          invitedBusinessName:
            invitation.business.name,
        },
        { status: 409 }
      );
    }

    // --------------------------------------------------
    // Subscription
    // --------------------------------------------------

    const subscription =
      await db.subscription.findUnique({
        where: {
          businessId:
            invitation.businessId,
        },
      });

    if (!subscription) {
      return NextResponse.json(
        {
          success: false,

          message:
            "The invited business does not have an active subscription.",

          code:
            "SUBSCRIPTION_NOT_FOUND",
        },
        { status: 409 }
      );
    }

    if (
      subscription.status !== "ACTIVE"
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "The business subscription is not active.",

          code:
            "SUBSCRIPTION_INACTIVE",
        },
        { status: 403 }
      );
    }

    const limits =
      getPlanLimits(
        subscription.plan
      );

    // --------------------------------------------------
    // Current team-member usage
    //
    // At acceptance time we count actual members.
    // This invitation itself already represents the
    // slot that is now being converted into a member.
    // --------------------------------------------------

    const currentMembers =
      await db.businessMember.count({
        where: {
          businessId:
            invitation.businessId,
        },
      });

    if (
      currentMembers >=
      limits.teamMembers
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            `The ${subscription.plan} plan allows a maximum of ${limits.teamMembers} team member${
              limits.teamMembers === 1
                ? ""
                : "s"
            }. The business has reached its team limit.`,

          code:
            "TEAM_LIMIT_REACHED",

          plan:
            subscription.plan,

          teamLimit:
            limits.teamMembers,

          currentMembers,
        },
        { status: 403 }
      );
    }

    // --------------------------------------------------
    // Accept invitation
    // --------------------------------------------------

    await db.$transaction(
      async (tx) => {
        await tx.businessMember.create({
          data: {
            businessId:
              invitation.businessId,

            userId:
              user.id,

            role:
              invitation.role,
          },
        });

        await tx.teamInvitation.update({
          where: {
            id:
              invitation.id,
          },

          data: {
            status:
              "ACCEPTED",
          },
        });
      }
    );

    // --------------------------------------------------
    // Success
    // --------------------------------------------------

    return NextResponse.json({
      success: true,

      message:
        `You have joined ${invitation.business.name}.`,

      businessName:
        invitation.business.name,

      role:
        invitation.role,

      plan:
        subscription.plan,
    });
  } catch (error) {
    console.error(
      "ACCEPT TEAM INVITATION ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          "Unable to accept invitation.",
      },
      { status: 500 }
    );
  }
}