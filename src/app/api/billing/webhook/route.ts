import {
  createHmac,
  timingSafeEqual,
} from "crypto";

import { NextResponse } from "next/server";

import { db } from "@/lib/db";

type RazorpaySubscription = {
  id?: string;
  plan_id?: string;
  customer_id?: string | null;
  status?: string;
  current_start?: number | null;
  current_end?: number | null;
};

type RazorpayWebhookPayload = {
  event?: string;

  payload?: {
    subscription?: {
      entity?: RazorpaySubscription;
    };
  };
};

function verifyWebhookSignature(
  rawBody: string,
  receivedSignature: string,
  secret: string
) {
  const expectedSignature =
    createHmac(
      "sha256",
      secret
    )
      .update(rawBody)
      .digest("hex");

  const expectedBuffer =
    Buffer.from(
      expectedSignature,
      "utf8"
    );

  const receivedBuffer =
    Buffer.from(
      receivedSignature,
      "utf8"
    );

  return (
    expectedBuffer.length ===
      receivedBuffer.length &&
    timingSafeEqual(
      expectedBuffer,
      receivedBuffer
    )
  );
}

function unixToDate(
  value?: number | null
) {
  if (
    typeof value !== "number"
  ) {
    return undefined;
  }

  return new Date(
    value * 1000
  );
}

export async function POST(
  request: Request
) {
  try {
    // IMPORTANT:
    // Read raw body BEFORE JSON parsing.
    const rawBody =
      await request.text();

    const signature =
      request.headers.get(
        "x-razorpay-signature"
      );

    const webhookSecret =
      process.env
        .RAZORPAY_WEBHOOK_SECRET;

    if (
      !signature ||
      !webhookSecret
    ) {
      console.error(
        "RAZORPAY WEBHOOK SIGNATURE OR SECRET MISSING"
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Webhook authentication failed.",
        },
        {
          status: 401,
        }
      );
    }

    // ----------------------------------------
    // Verify Razorpay signature
    // ----------------------------------------

    const validSignature =
      verifyWebhookSignature(
        rawBody,
        signature,
        webhookSecret
      );

    if (!validSignature) {
      console.error(
        "INVALID RAZORPAY WEBHOOK SIGNATURE"
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid webhook signature.",
        },
        {
          status: 401,
        }
      );
    }

    // ----------------------------------------
    // Parse only AFTER verification
    // ----------------------------------------

    let payload:
      RazorpayWebhookPayload;

    try {
      payload =
        JSON.parse(
          rawBody
        ) as RazorpayWebhookPayload;
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid webhook payload.",
        },
        {
          status: 400,
        }
      );
    }

    const event =
      payload.event;

    const providerSubscription =
      payload.payload
        ?.subscription
        ?.entity;

    // ----------------------------------------
    // Ignore unrelated Razorpay events
    // ----------------------------------------

    if (
      !event ||
      !providerSubscription?.id
    ) {
      return NextResponse.json({
        success: true,
        ignored: true,
      });
    }

    const providerSubscriptionId =
      providerSubscription.id;

    // ----------------------------------------
    // Find our local subscription
    //
    // Never trust businessId from webhook
    // notes for database ownership.
    // ----------------------------------------

    const localSubscription =
      await db.subscription.findFirst({
        where: {
          provider:
            "RAZORPAY",

          providerSubscriptionId,
        },
      });

    if (!localSubscription) {
      console.warn(
        "UNKNOWN RAZORPAY SUBSCRIPTION:",
        providerSubscriptionId
      );

      return NextResponse.json({
        success: true,
        ignored: true,
      });
    }

    // ----------------------------------------
    // Verify provider Plan ID
    // ----------------------------------------

    const starterPlanId =
      process.env
        .RAZORPAY_STARTER_PLAN_ID;

    const proPlanId =
      process.env
        .RAZORPAY_PRO_PLAN_ID;

    let verifiedPlan:
      | "STARTER"
      | "PRO"
      | null =
      null;

    if (
      providerSubscription.plan_id ===
      starterPlanId
    ) {
      verifiedPlan =
        "STARTER";
    }

    if (
      providerSubscription.plan_id ===
      proPlanId
    ) {
      verifiedPlan =
        "PRO";
    }

    if (!verifiedPlan) {
      console.error(
        "UNKNOWN RAZORPAY PLAN:",
        providerSubscription.plan_id
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Unknown Razorpay plan.",
        },
        {
          status: 400,
        }
      );
    }

    const currentPeriodStart =
      unixToDate(
        providerSubscription
          .current_start
      );

    const currentPeriodEnd =
      unixToDate(
        providerSubscription
          .current_end
      );

    // ----------------------------------------
    // subscription.activated
    // First successful activation
    // ----------------------------------------

    if (
      event ===
      "subscription.activated"
    ) {
      await db.subscription.update({
        where: {
          id:
            localSubscription.id,
        },

        data: {
          plan:
            verifiedPlan,

          status:
            "ACTIVE",

          providerCustomerId:
            providerSubscription
              .customer_id ??
            localSubscription
              .providerCustomerId,

          ...(currentPeriodStart
            ? {
                currentPeriodStart,
              }
            : {}),

          ...(currentPeriodEnd
            ? {
                currentPeriodEnd,
              }
            : {}),
        },
      });
    }

    // ----------------------------------------
    // subscription.charged
    // Successful recurring payment
    // ----------------------------------------

    else if (
      event ===
      "subscription.charged"
    ) {
      await db.subscription.update({
        where: {
          id:
            localSubscription.id,
        },

        data: {
          plan:
            verifiedPlan,

          status:
            "ACTIVE",

          providerCustomerId:
            providerSubscription
              .customer_id ??
            localSubscription
              .providerCustomerId,

          ...(currentPeriodStart
            ? {
                currentPeriodStart,
              }
            : {}),

          ...(currentPeriodEnd
            ? {
                currentPeriodEnd,
              }
            : {}),
        },
      });
    }

    // ----------------------------------------
    // subscription.pending
    // Payment problem / retry state
    // ----------------------------------------

    else if (
      event ===
      "subscription.pending"
    ) {
      await db.subscription.update({
        where: {
          id:
            localSubscription.id,
        },

        data: {
          status:
            "PAST_DUE",
        },
      });
    }

    // ----------------------------------------
    // subscription.halted
    // Retries exhausted
    // ----------------------------------------

    else if (
      event ===
      "subscription.halted"
    ) {
      await db.subscription.update({
        where: {
          id:
            localSubscription.id,
        },

        data: {
          status:
            "PAST_DUE",
        },
      });
    }

    // ----------------------------------------
    // subscription.cancelled
    // ----------------------------------------

    else if (
  event ===
  "subscription.cancelled"
) {
  await db.subscription.update({
    where: {
      id:
        localSubscription.id,
    },

    data: {
      status:
        "CANCELLED",

      cancelAtPeriodEnd:
        false,
    },
  });
}

    // ----------------------------------------
    // subscription.completed
    // ----------------------------------------

    else if (
  event ===
  "subscription.completed"
) {
  await db.subscription.update({
    where: {
      id:
        localSubscription.id,
    },

    data: {
      status:
        "EXPIRED",

      cancelAtPeriodEnd:
        false,
    },
  });
}

    // ----------------------------------------
    // Other verified events
    // ----------------------------------------

    else {
      return NextResponse.json({
        success: true,
        ignored: true,
        event,
      });
    }

    return NextResponse.json({
      success: true,
      event,
    });
  } catch (error) {
    console.error(
      "RAZORPAY WEBHOOK ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Webhook processing failed.",
      },
      {
        status: 500,
      }
    );
  }
}