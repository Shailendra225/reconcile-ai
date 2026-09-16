import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { razorpay } from "@/lib/razorpay";
import { getCurrentMembership } from "@/lib/getCurrentMembership";

type UpgradePlan = "STARTER" | "PRO";

type RazorpayExistingSubscription = {
  id: string;
  plan_id?: string;
  status?: string;
};

export async function POST(
  request: Request
) {
  try {
    // ----------------------------------------
    // Authentication + workspace
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
    // OWNER / ADMIN only
    // ----------------------------------------

    if (
      membership.role !== "OWNER" &&
      membership.role !== "ADMIN"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You do not have permission to manage billing.",
        },
        {
          status: 403,
        }
      );
    }

    // ----------------------------------------
    // Requested plan
    // ----------------------------------------

    const body =
      await request.json();

    const plan =
      typeof body.plan === "string"
        ? body.plan
            .trim()
            .toUpperCase()
        : "";

    if (
      plan !== "STARTER" &&
      plan !== "PRO"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Plan must be STARTER or PRO.",
        },
        {
          status: 400,
        }
      );
    }

    const selectedPlan =
      plan as UpgradePlan;

    // ----------------------------------------
    // Razorpay configuration
    // ----------------------------------------

    const keyId =
      process.env.RAZORPAY_KEY_ID;

    const razorpayPlanId =
      selectedPlan === "STARTER"
        ? process.env
            .RAZORPAY_STARTER_PLAN_ID
        : process.env
            .RAZORPAY_PRO_PLAN_ID;

    if (
      !keyId ||
      !razorpayPlanId
    ) {
      console.error(
        `RAZORPAY CONFIGURATION MISSING FOR ${selectedPlan}`
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Billing configuration is incomplete.",
        },
        {
          status: 500,
        }
      );
    }

    // ----------------------------------------
    // Current local subscription
    // ----------------------------------------

    const currentSubscription =
      await db.subscription.findUnique({
        where: {
          businessId:
            membership.businessId,
        },
      });

    if (!currentSubscription) {
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

    // ----------------------------------------
    // Same paid plan already active
    // ----------------------------------------

    if (
      currentSubscription.plan ===
        selectedPlan &&
      currentSubscription.status ===
        "ACTIVE" &&
      currentSubscription.provider ===
        "RAZORPAY"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            `Your business is already on the ${selectedPlan} plan.`,
        },
        {
          status: 409,
        }
      );
    }

    // ----------------------------------------
    // Existing Razorpay subscription
    //
    // If checkout was opened previously,
    // inspect that subscription instead of
    // blindly blocking the user.
    // ----------------------------------------

    if (
      currentSubscription
        .providerSubscriptionId &&
      currentSubscription.provider ===
        "RAZORPAY"
    ) {
      try {
        const existing =
          (await razorpay.subscriptions.fetch(
            currentSubscription
              .providerSubscriptionId
          )) as RazorpayExistingSubscription;

        const reusableStatuses = [
          "created",
          "authenticated",
          "pending",
        ];

        // ------------------------------------
        // Same plan + reusable provider state
        //
        // Reopen checkout using the same
        // Razorpay subscription.
        // ------------------------------------

        if (
          existing.plan_id ===
            razorpayPlanId &&
          existing.status &&
          reusableStatuses.includes(
            existing.status
          )
        ) {
          return NextResponse.json({
            success: true,

            message:
              "Existing Razorpay subscription reused.",

            subscriptionId:
              existing.id,

            keyId,

            plan:
              selectedPlan,

            reused:
              true,

            business: {
              name:
                membership.business.name,

              email:
                membership.business.email ??
                "",
            },
          });
        }

        // ------------------------------------
        // Existing provider subscription is
        // already active.
        //
        // Do not create another subscription.
        // ------------------------------------

        if (
          existing.status === "active"
        ) {
          return NextResponse.json(
            {
              success: false,

              message:
                "An active Razorpay subscription already exists for this business.",

              code:
                "ACTIVE_SUBSCRIPTION_EXISTS",
            },
            {
              status: 409,
            }
          );
        }

        // ------------------------------------
        // Old subscription cannot be reused.
        //
        // Clear only our local reference.
        // We are NOT activating or changing
        // the local paid plan here.
        // ------------------------------------

        await db.subscription.update({
          where: {
            businessId:
              membership.businessId,
          },

          data: {
            providerSubscriptionId:
              null,
          },
        });
      } catch (error) {
        console.error(
          "FETCH EXISTING RAZORPAY SUBSCRIPTION ERROR:",
          error
        );

        // ------------------------------------
        // Provider reference may be stale or
        // invalid. Clear the local reference
        // so checkout can be started again.
        // ------------------------------------

        await db.subscription.update({
          where: {
            businessId:
              membership.businessId,
          },

          data: {
            providerSubscriptionId:
              null,
          },
        });
      }
    }

    // ----------------------------------------
    // Create new Razorpay subscription
    // ----------------------------------------

    const razorpaySubscription =
      await razorpay.subscriptions.create({
        plan_id:
          razorpayPlanId,

        total_count:
          120,

        quantity:
          1,

        customer_notify:
          1,

        notes: {
          businessId:
            membership.businessId,

          businessName:
            membership.business.name,

          reconcilePlan:
            selectedPlan,
        },
      });

    // ----------------------------------------
    // Save provider reference
    //
    // IMPORTANT:
    // Do not activate STARTER/PRO here.
    // Payment verification handles activation.
    // ----------------------------------------

    await db.subscription.update({
      where: {
        businessId:
          membership.businessId,
      },

      data: {
        provider:
          "RAZORPAY",

        providerSubscriptionId:
          razorpaySubscription.id,
      },
    });

    // ----------------------------------------
    // Checkout response
    // ----------------------------------------

    return NextResponse.json({
      success: true,

      message:
        "Razorpay subscription created.",

      subscriptionId:
        razorpaySubscription.id,

      keyId,

      plan:
        selectedPlan,

      reused:
        false,

      business: {
        name:
          membership.business.name,

        email:
          membership.business.email ??
          "",
      },
    });
  } catch (error) {
    console.error(
      "CREATE RAZORPAY SUBSCRIPTION ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "Unable to create subscription.",
      },
      {
        status: 500,
      }
    );
  }
}