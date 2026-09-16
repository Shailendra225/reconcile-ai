"use client";

import { useState } from "react";

type Plan = "STARTER" | "PRO";

type RazorpayResponse = {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  subscription_id: string;
  name: string;
  description: string;

  handler: (
    response: RazorpayResponse
  ) => void | Promise<void>;

  prefill?: {
    name?: string;
    email?: string;
  };

  theme?: {
    color?: string;
  };
};

declare global {
  interface Window {
    Razorpay: new (
      options: RazorpayOptions
    ) => {
      open: () => void;
    };
  }
}

type Props = {
  plan: Plan;
  price: number;
  businessName: string;
  email: string;
};

function loadRazorpayScript() {
  return new Promise<boolean>(
    (resolve) => {
      // Razorpay already loaded
      if (window.Razorpay) {
        resolve(true);
        return;
      }

      // Check whether script already exists
      const existingScript =
        document.querySelector<HTMLScriptElement>(
          'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
        );

      if (existingScript) {
        existingScript.addEventListener(
          "load",
          () => resolve(true)
        );

        existingScript.addEventListener(
          "error",
          () => resolve(false)
        );

        return;
      }

      // Load Razorpay checkout script
      const script =
        document.createElement("script");

      script.src =
        "https://checkout.razorpay.com/v1/checkout.js";

      script.async = true;

      script.onload = () =>
        resolve(true);

      script.onerror = () =>
        resolve(false);

      document.body.appendChild(script);
    }
  );
}

export default function UpgradePlanButton({
  plan,
  price,
  businessName,
  email,
}: Props) {
  const [loading, setLoading] =
    useState(false);

  async function handleUpgrade() {
    try {
      setLoading(true);

      // --------------------------------------
      // 1. Load Razorpay Checkout
      // --------------------------------------

      const loaded =
        await loadRazorpayScript();

      if (!loaded) {
        alert(
          "Unable to load Razorpay Checkout."
        );

        return;
      }

      // --------------------------------------
      // 2. Create Razorpay Subscription
      // --------------------------------------

      const response =
        await fetch(
          "/api/billing/create-subscription",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              plan,
            }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        alert(
          data.message ||
            "Unable to start subscription."
        );

        return;
      }

      // --------------------------------------
      // 3. Razorpay Checkout Options
      // --------------------------------------

      const options: RazorpayOptions = {
        key: data.keyId,

        subscription_id:
          data.subscriptionId,

        name: "Reconcile AI",

        description:
          `${plan} Plan - ₹${price}/month`,

        prefill: {
          name: businessName,
          email,
        },

        theme: {
          color: "#2563eb",
        },

        // ------------------------------------
        // 4. Payment Success Handler
        // ------------------------------------

        handler: async (
          paymentResponse
        ) => {
          try {
            // --------------------------------
            // Verify payment on our server
            // --------------------------------

            const verifyResponse =
              await fetch(
                "/api/billing/verify-subscription",
                {
                  method: "POST",

                  headers: {
                    "Content-Type":
                      "application/json",
                  },

                  body: JSON.stringify({
                    paymentId:
                      paymentResponse
                        .razorpay_payment_id,

                    subscriptionId:
                      paymentResponse
                        .razorpay_subscription_id,

                    signature:
                      paymentResponse
                        .razorpay_signature,

                    plan,
                  }),
                }
              );

            const verifyData =
              await verifyResponse.json();

            // --------------------------------
            // Verification Failed
            // --------------------------------

            if (
              !verifyResponse.ok ||
              !verifyData.success
            ) {
              alert(
                verifyData.message ||
                  "Payment completed, but plan verification failed."
              );

              return;
            }

            // --------------------------------
            // Verification Successful
            // --------------------------------

            alert(
              `${plan} plan activated successfully!`
            );

            window.location.reload();
          } catch (error) {
            console.error(
              "PAYMENT VERIFICATION ERROR:",
              error
            );

            alert(
              "Payment completed, but we could not verify the subscription. Please refresh and try again."
            );
          }
        },
      };

      // --------------------------------------
      // 5. Open Razorpay Checkout
      // --------------------------------------

      const checkout =
        new window.Razorpay(options);

      checkout.open();
    } catch (error) {
      console.error(
        "UPGRADE ERROR:",
        error
      );

      alert(
        "Unable to start subscription."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleUpgrade}
      disabled={loading}
      className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading
        ? "Opening Checkout..."
        : `Choose ${plan} — ₹${price}/month`}
    </button>
  );
}