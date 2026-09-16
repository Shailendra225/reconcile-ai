import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { Resend } from "resend";

import { db } from "@/lib/db";
import { getPlanLimits } from "@/lib/plans";

const resend = new Resend(
  process.env.RESEND_API_KEY
);

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),

  // ----------------------------------------
  // Email verification
  // ----------------------------------------

  emailVerification: {
    sendVerificationEmail: async ({
      user,
      url,
    }) => {
      const { error } =
        await resend.emails.send({
          from: "Reconcile AI <onboarding@resend.dev>",
          to: user.email,
          subject:
            "Verify your Reconcile AI email",

          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
              <h2>Verify your email</h2>

              <p>
                Hi ${user.name},
              </p>

              <p>
                Thanks for signing up for Reconcile AI.
                Please verify your email address to continue.
              </p>

              <p style="margin: 30px 0;">
                <a
                  href="${url}"
                  style="
                    background: #0891b2;
                    color: white;
                    padding: 12px 20px;
                    text-decoration: none;
                    border-radius: 6px;
                    display: inline-block;
                  "
                >
                  Verify Email
                </a>
              </p>

              <p>
                If you did not create this account,
                you can ignore this email.
              </p>
            </div>
          `,
        });

      if (error) {
        console.error(
          "VERIFICATION EMAIL ERROR:",
          error
        );
      }
    },

    sendOnSignUp: true,
    sendOnSignIn: true,

    expiresIn: 3600,
  },

  // ----------------------------------------
  // Email + password authentication
  // ----------------------------------------

  emailAndPassword: {
    enabled: true,

    requireEmailVerification: true,

    resetPasswordTokenExpiresIn: 3600,

    revokeSessionsOnPasswordReset: true,

    sendResetPassword: async ({
      user,
      url,
    }) => {
      const { error } =
        await resend.emails.send({
          from: "Reconcile AI <onboarding@resend.dev>",
          to: user.email,
          subject:
            "Reset your Reconcile AI password",

          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
              <h2>Reset your password</h2>

              <p>Hi ${user.name},</p>

              <p>
                We received a request to reset your
                Reconcile AI password.
              </p>

              <p style="margin: 30px 0;">
                <a
                  href="${url}"
                  style="
                    background: #0891b2;
                    color: white;
                    padding: 12px 20px;
                    text-decoration: none;
                    border-radius: 6px;
                    display: inline-block;
                  "
                >
                  Reset Password
                </a>
              </p>

              <p>
                This link will expire in 1 hour.
              </p>

              <p>
                If you did not request a password reset,
                you can ignore this email.
              </p>
            </div>
          `,
        });

      if (error) {
        console.error(
          "RESET PASSWORD EMAIL ERROR:",
          error
        );
      }
    },
  },

  // ----------------------------------------
  // New user workspace setup
  // ----------------------------------------

  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const normalizedEmail =
            user.email
              .trim()
              .toLowerCase();

          // ----------------------------------
          // Check for valid team invitation
          // ----------------------------------

          const invitation =
            await db.teamInvitation.findFirst({
              where: {
                email:
                  normalizedEmail,

                status:
                  "PENDING",

                expiresAt: {
                  gt:
                    new Date(),
                },
              },

              orderBy: {
                createdAt:
                  "desc",
              },
            });

          // ----------------------------------
          // Invited user
          // ----------------------------------

          if (invitation) {
            const subscription =
              await db.subscription.findUnique({
                where: {
                  businessId:
                    invitation.businessId,
                },
              });

            // --------------------------------
            // Subscription must exist
            // --------------------------------

            if (!subscription) {
              console.error(
                "INVITED USER WORKSPACE ERROR:",
                "Subscription not found for invited business."
              );

              return;
            }

            // --------------------------------
            // Subscription must be active
            // --------------------------------

            if (
              subscription.status !==
              "ACTIVE"
            ) {
              console.error(
                "INVITED USER WORKSPACE ERROR:",
                "Subscription is not active."
              );

              return;
            }

            const limits =
              getPlanLimits(
                subscription.plan
              );

            // --------------------------------
            // Check current team usage
            // --------------------------------

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
              console.error(
                "INVITED USER WORKSPACE ERROR:",
                `Team limit reached for ${subscription.plan} plan.`
              );

              // Keep invitation PENDING.
              // Do not create membership.
              return;
            }

            // --------------------------------
            // Join invited workspace
            // --------------------------------

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

            return;
          }

          // ----------------------------------
          // Normal signup
          //
          // Create:
          // 1. Business
          // 2. OWNER membership
          // 3. FREE subscription
          // ----------------------------------

          await db.$transaction(
            async (tx) => {
              const business =
                await tx.business.create({
                  data: {
                    name:
                      `${user.name}'s Business`,

                    email:
                      normalizedEmail,

                    ownerId:
                      user.id,
                  },
                });

              await tx.businessMember.create({
                data: {
                  businessId:
                    business.id,

                  userId:
                    user.id,

                  role:
                    "OWNER",
                },
              });

              await tx.subscription.create({
                data: {
                  businessId:
                    business.id,

                  plan:
                    "FREE",

                  status:
                    "ACTIVE",
                },
              });
            }
          );
        },
      },
    },
  },
});