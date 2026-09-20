import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { razorpay } from "@/lib/razorpay";
import { getCurrentMembership } from "@/lib/getCurrentMembership";

export async function POST() {
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
    // Local subscription
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
          status: 404,
        }
      );
    }

    // ----------------------------------------
    // FREE plan has nothing to cancel
    // ----------------------------------------

    if (subscription.plan === "FREE") {
      return NextResponse.json(
        {
          success: false,
          message:
            "The FREE plan does not have a paid subscription to cancel.",
        },
        {
          status: 409,
        }
      );
    }

    // ----------------------------------------
    // Razorpay subscription required
    // ----------------------------------------

    if (
      subscription.provider !== "RAZORPAY" ||
      !subscription.providerSubscriptionId
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "No Razorpay subscription is associated with this business.",
        },
        {
          status: 409,
        }
      );
    }

    // ----------------------------------------
    // Already finished
    // ----------------------------------------

    if (
      subscription.status === "CANCELLED" ||
      subscription.status === "EXPIRED"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This subscription is already cancelled or expired.",
        },
        {
          status: 409,
        }
      );
    }

    // ----------------------------------------
    // Cancellation already scheduled
    //
    // Prevent repeated calls to Razorpay.
    // ----------------------------------------

    if (subscription.cancelAtPeriodEnd) {
      return NextResponse.json(
        {
          success: true,
          message:
            "Subscription cancellation is already scheduled.",
          alreadyScheduled: true,
          currentPeriodEnd:
            subscription.currentPeriodEnd,
        },
        {
          status: 200,
        }
      );
    }

    // ----------------------------------------
    // Cancel at end of current billing cycle
    //
    // true = cancel_at_cycle_end
    //
    // Customer keeps access for the period
    // they have already paid for.
    // ----------------------------------------

    const cancelledSubscription =
      await razorpay.subscriptions.cancel(
        subscription.providerSubscriptionId,
        true
      );

    // ----------------------------------------
    // Store cancellation intent locally
    //
    // Do NOT mark subscription CANCELLED yet.
    // The actual provider cancellation will
    // be synchronized by the Razorpay webhook.
    // ----------------------------------------

    const updatedSubscription =
      await db.subscription.update({
        where: {
          businessId:
            membership.businessId,
        },

        data: {
          cancelAtPeriodEnd: true,
        },
      });

    // ----------------------------------------
    // Success
    // ----------------------------------------

    return NextResponse.json({
      success: true,

      message:
        "Subscription cancellation scheduled successfully.",

      alreadyScheduled: false,

      providerSubscriptionId:
        cancelledSubscription.id,

      providerStatus:
        cancelledSubscription.status,

      plan:
        updatedSubscription.plan,

      status:
        updatedSubscription.status,

      cancelAtPeriodEnd:
        updatedSubscription.cancelAtPeriodEnd,

      currentPeriodEnd:
        updatedSubscription.currentPeriodEnd,
    });
  } catch (error) {
    console.error(
      "CANCEL RAZORPAY SUBSCRIPTION ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to cancel subscription.",
      },
      {
        status: 500,
      }
    );
  }
}