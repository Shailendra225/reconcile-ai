import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getCurrentMembership } from "@/lib/getCurrentMembership";

type PaidPlan =
  | "STARTER"
  | "PRO";

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
    // Billing permission
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
    // Request data
    // ----------------------------------------

    const body =
      await request.json();

    const paymentId =
      typeof body.paymentId === "string"
        ? body.paymentId.trim()
        : "";

    const subscriptionId =
      typeof body.subscriptionId ===
      "string"
        ? body.subscriptionId.trim()
        : "";

    const signature =
      typeof body.signature === "string"
        ? body.signature.trim()
        : "";

    const requestedPlan =
      typeof body.plan === "string"
        ? body.plan
            .trim()
            .toUpperCase()
        : "";

    if (
      !paymentId ||
      !subscriptionId ||
      !signature
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Payment verification data is incomplete.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      requestedPlan !== "STARTER" &&
      requestedPlan !== "PRO"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid subscription plan.",
        },
        {
          status: 400,
        }
      );
    }

    const plan =
      requestedPlan as PaidPlan;

    // ----------------------------------------
    // Razorpay secret
    // ----------------------------------------

    const keySecret =
      process.env
        .RAZORPAY_KEY_SECRET;

    if (!keySecret) {
      console.error(
        "RAZORPAY_KEY_SECRET IS MISSING"
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
    // Critical ownership check
    //
    // The subscription being verified must be
    // exactly the Razorpay subscription created
    // for this workspace.
    // ----------------------------------------

    if (
      currentSubscription.provider !==
        "RAZORPAY" ||
      currentSubscription
        .providerSubscriptionId !==
        subscriptionId
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Subscription does not belong to this business.",
        },
        {
          status: 403,
        }
      );
    }

    // ----------------------------------------
    // Prevent client from changing plan value
    //
    // Determine expected Razorpay plan ID from
    // the requested local plan.
    // ----------------------------------------

    const expectedPlanId =
      plan === "STARTER"
        ? process.env
            .RAZORPAY_STARTER_PLAN_ID
        : process.env
            .RAZORPAY_PRO_PLAN_ID;

    if (!expectedPlanId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Billing plan configuration is incomplete.",
        },
        {
          status: 500,
        }
      );
    }

    // ----------------------------------------
    // Verify Razorpay subscription itself
    //
    // This prevents trusting only values sent
    // by the browser.
    // ----------------------------------------

    const razorpayResponse =
      await fetch(
        `https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(
          subscriptionId
        )}`,
        {
          method: "GET",

          headers: {
            Authorization:
              `Basic ${Buffer.from(
                `${process.env.RAZORPAY_KEY_ID}:${keySecret}`
              ).toString("base64")}`,
          },

          cache: "no-store",
        }
      );

    if (!razorpayResponse.ok) {
      console.error(
        "RAZORPAY SUBSCRIPTION FETCH FAILED:",
        razorpayResponse.status
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Unable to verify Razorpay subscription.",
        },
        {
          status: 502,
        }
      );
    }

    const razorpaySubscription =
      (await razorpayResponse.json()) as {
        id?: string;
        plan_id?: string;
        status?: string;
        current_start?: number;
        current_end?: number;
      };

    if (
      razorpaySubscription.id !==
        subscriptionId ||
      razorpaySubscription.plan_id !==
        expectedPlanId
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Razorpay subscription plan verification failed.",
        },
        {
          status: 403,
        }
      );
    }

    // ----------------------------------------
    // Verify Razorpay checkout signature
    //
    // Razorpay subscription checkout:
    //
    // HMAC_SHA256(
    //   payment_id + "|" + subscription_id,
    //   key_secret
    // )
    // ----------------------------------------

    const payload =
      `${paymentId}|${subscriptionId}`;

    const expectedSignature =
      createHmac(
        "sha256",
        keySecret
      )
        .update(payload)
        .digest("hex");

    const expectedBuffer =
      Buffer.from(
        expectedSignature,
        "utf8"
      );

    const receivedBuffer =
      Buffer.from(
        signature,
        "utf8"
      );

    const signatureValid =
      expectedBuffer.length ===
        receivedBuffer.length &&
      timingSafeEqual(
        expectedBuffer,
        receivedBuffer
      );

    if (!signatureValid) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Payment signature verification failed.",
        },
        {
          status: 403,
        }
      );
    }

    // ----------------------------------------
    // Razorpay subscription must be active
    // ----------------------------------------

    if (
      razorpaySubscription.status !==
      "active"
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Payment was verified, but the Razorpay subscription is not active yet.",

          providerStatus:
            razorpaySubscription.status ??
            "unknown",
        },
        {
          status: 409,
        }
      );
    }

    // ----------------------------------------
    // Convert Razorpay UNIX timestamps
    // ----------------------------------------

    const periodStart =
      typeof razorpaySubscription
        .current_start === "number"
        ? new Date(
            razorpaySubscription
              .current_start * 1000
          )
        : new Date();

    const periodEnd =
      typeof razorpaySubscription
        .current_end === "number"
        ? new Date(
            razorpaySubscription
              .current_end * 1000
          )
        : null;

    // ----------------------------------------
    // Activate local paid plan
    // ----------------------------------------

    const updatedSubscription =
      await db.subscription.update({
        where: {
          businessId:
            membership.businessId,
        },

        data: {
          plan,

          status:
            "ACTIVE",

          provider:
            "RAZORPAY",

          providerSubscriptionId:
            subscriptionId,

          currentPeriodStart:
            periodStart,

          currentPeriodEnd:
            periodEnd,
        },
      });

    // ----------------------------------------
    // Success
    // ----------------------------------------

    return NextResponse.json({
      success: true,

      message:
        `${plan} plan activated successfully.`,

      subscription: {
        plan:
          updatedSubscription.plan,

        status:
          updatedSubscription.status,

        currentPeriodStart:
          updatedSubscription
            .currentPeriodStart,

        currentPeriodEnd:
          updatedSubscription
            .currentPeriodEnd,
      },
    });
  } catch (error) {
    console.error(
      "VERIFY RAZORPAY SUBSCRIPTION ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          "Unable to verify subscription payment.",
      },
      {
        status: 500,
      }
    );
  }
}