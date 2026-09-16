import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { Resend } from "resend";

import { db } from "@/lib/db";
import { getCurrentMembership } from "@/lib/getCurrentMembership";
import { getPlanLimits } from "@/lib/plans";

const resend = new Resend(
  process.env.RESEND_API_KEY
);

const INVITE_EXPIRY_DAYS = 7;

export async function POST(request: Request) {
  try {
    // ----------------------------------------
    // Authentication + workspace membership
    // ----------------------------------------

    const membership =
      await getCurrentMembership();

    if (!membership) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }

    // ----------------------------------------
    // Only OWNER / ADMIN can invite
    // ----------------------------------------

    if (
      membership.role !== "OWNER" &&
      membership.role !== "ADMIN"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You do not have permission to invite team members.",
        },
        {
          status: 403,
        }
      );
    }

    const body = await request.json();

    const email =
      typeof body.email === "string"
        ? body.email
            .trim()
            .toLowerCase()
        : "";

    const role =
      typeof body.role === "string"
        ? body.role
            .trim()
            .toUpperCase()
        : "";

    // ----------------------------------------
    // Validate email
    // ----------------------------------------

    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (
      !email ||
      !emailRegex.test(email)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Please enter a valid email address.",
        },
        {
          status: 400,
        }
      );
    }

    // ----------------------------------------
    // Validate role
    //
    // OWNER cannot be assigned by invitation
    // ----------------------------------------

    const allowedRoles = [
      "ADMIN",
      "ACCOUNTANT",
      "VIEWER",
    ] as const;

    if (
      !allowedRoles.includes(
        role as
          (typeof allowedRoles)[number]
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid team role.",
        },
        {
          status: 400,
        }
      );
    }

    // ----------------------------------------
    // Check existing user / membership first
    // ----------------------------------------

    const existingUser =
      await db.user.findUnique({
        where: {
          email,
        },

        select: {
          id: true,
          email: true,
        },
      });

    if (existingUser) {
      const existingMember =
        await db.businessMember.findUnique({
          where: {
            businessId_userId: {
              businessId:
                membership.businessId,

              userId:
                existingUser.id,
            },
          },
        });

      if (existingMember) {
        return NextResponse.json(
          {
            success: false,
            message:
              "This user is already a member of your business.",
          },
          {
            status: 409,
          }
        );
      }
    }

    // ----------------------------------------
    // Subscription
    // ----------------------------------------

    const subscription =
      await db.subscription.findUnique({
        where: {
          businessId:
            membership.businessId,
        },
      });

    if (!subscription) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Business subscription could not be found.",
        },
        {
          status: 409,
        }
      );
    }

    if (
      subscription.status !== "ACTIVE"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Your subscription is not active.",
        },
        {
          status: 403,
        }
      );
    }

    const limits =
      getPlanLimits(
        subscription.plan
      );

    // ----------------------------------------
    // Find previous pending invitation
    // for the same email
    //
    // We don't count this as an additional
    // slot because it will be replaced.
    // ----------------------------------------

    const existingInvitation =
      await db.teamInvitation.findFirst({
        where: {
          businessId:
            membership.businessId,

          email,

          status:
            "PENDING",
        },

        orderBy: {
          createdAt:
            "desc",
        },
      });

    // ----------------------------------------
    // Team usage
    //
    // Total slots =
    // existing members
    // + valid pending invitations
    //
    // OWNER is included in member count.
    // ----------------------------------------

    const now = new Date();

    const [
      memberCount,
      pendingInvitationCount,
    ] = await Promise.all([
      db.businessMember.count({
        where: {
          businessId:
            membership.businessId,
        },
      }),

      db.teamInvitation.count({
        where: {
          businessId:
            membership.businessId,

          status:
            "PENDING",

          expiresAt: {
            gt: now,
          },

          // If this email already has a
          // pending invite, that invite will
          // be replaced, so don't consume
          // another slot for it here.
          ...(existingInvitation
            ? {
                id: {
                  not:
                    existingInvitation.id,
                },
              }
            : {}),
        },
      }),
    ]);

    const usedTeamSlots =
      memberCount +
      pendingInvitationCount;

    if (
      usedTeamSlots >=
      limits.teamMembers
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            `Your ${subscription.plan} plan allows up to ${limits.teamMembers} team member${
              limits.teamMembers === 1
                ? ""
                : "s"
            }. Upgrade your plan to invite more members.`,
        },
        {
          status: 403,
        }
      );
    }

    // ----------------------------------------
    // Cancel previous pending invitation
    // for same email
    // ----------------------------------------

    if (existingInvitation) {
      await db.teamInvitation.update({
        where: {
          id:
            existingInvitation.id,
        },

        data: {
          status:
            "CANCELLED",
        },
      });
    }

    // ----------------------------------------
    // Create secure invitation
    // ----------------------------------------

    const token =
      randomBytes(32).toString(
        "hex"
      );

    const expiresAt =
      new Date();

    expiresAt.setDate(
      expiresAt.getDate() +
        INVITE_EXPIRY_DAYS
    );

    const invitation =
      await db.teamInvitation.create({
        data: {
          email,

          role:
            role as
              | "ADMIN"
              | "ACCOUNTANT"
              | "VIEWER",

          token,

          status:
            "PENDING",

          expiresAt,

          businessId:
            membership.businessId,
        },
      });

    // ----------------------------------------
    // Build invitation URL
    // ----------------------------------------

    const baseUrl =
      process.env.BETTER_AUTH_URL ||
      "http://localhost:3000";

    const inviteUrl =
      `${baseUrl}/invite/accept?token=` +
      encodeURIComponent(token);

    // ----------------------------------------
    // Send invitation email
    // ----------------------------------------

    const {
      error: emailError,
    } =
      await resend.emails.send({
        from:
          "Reconcile AI <onboarding@resend.dev>",

        to: email,

        subject:
          `You're invited to ${membership.business.name}`,

        html: `
          <div
            style="
              font-family: Arial, sans-serif;
              max-width: 600px;
              margin: auto;
              line-height: 1.6;
            "
          >
            <h2>
              You're invited to Reconcile AI
            </h2>

            <p>
              You have been invited to join
              <strong>${escapeHtml(
                membership.business.name
              )}</strong>.
            </p>

            <p>
              Your assigned role is:
              <strong>${role}</strong>
            </p>

            <p style="margin: 30px 0;">
              <a
                href="${inviteUrl}"
                style="
                  background: #0891b2;
                  color: white;
                  padding: 12px 20px;
                  text-decoration: none;
                  border-radius: 6px;
                  display: inline-block;
                "
              >
                Accept Invitation
              </a>
            </p>

            <p>
              This invitation expires in
              ${INVITE_EXPIRY_DAYS} days.
            </p>

            <p>
              If you were not expecting this
              invitation, you can ignore this email.
            </p>
          </div>
        `,
      });

    // ----------------------------------------
    // Email failed:
    // cancel invitation so it cannot be used
    // ----------------------------------------

    if (emailError) {
      console.error(
        "TEAM INVITATION EMAIL ERROR:",
        emailError
      );

      await db.teamInvitation.update({
        where: {
          id:
            invitation.id,
        },

        data: {
          status:
            "CANCELLED",
        },
      });

      return NextResponse.json(
        {
          success: false,
          message:
            "Invitation could not be emailed. Please try again.",
        },
        {
          status: 502,
        }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Invitation sent successfully.",
    });
  } catch (error) {
    console.error(
      "TEAM INVITATION ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to send invitation.",
      },
      {
        status: 500,
      }
    );
  }
}

function escapeHtml(
  value: string
) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}