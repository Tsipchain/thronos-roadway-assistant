"use client";
export const dynamic = 'force-dynamic';

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { redirect } from "next/navigation";

interface Subscription {
  id: string;
  plan: string;
  priceEur: number;
  isActive: boolean;
  endDate: string;
}

export default function SubscriptionPage() {
  const { data: session, status } = useSession();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/auth/signin");
    }

    if (status === "authenticated") {
      fetchSubscription();
    }
  }, [status]);

  const fetchSubscription = async () => {
    try {
      const res = await fetch("/api/subscription/current");
      if (res.ok) {
        const data = await res.json();
        setSubscription(data.subscription);
      }
    } catch (error) {
      console.error("Failed to fetch subscription:", error);
    }
  };

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/subscription-checkout", {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json();
        window.location.href = data.url;
      } else {
        setMessage("Failed to create checkout session");
      }
    } catch (error) {
      console.error("Checkout error:", error);
      setMessage("Checkout failed");
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  const isActive = subscription && subscription.isActive;
  const endsAt = subscription ? new Date(subscription.endDate) : null;
  const daysRemaining = endsAt
    ? Math.ceil((endsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-6">Annual Subscription</h1>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="text-sm font-semibold text-gray-600">Plan Details</div>
          <div className="mt-2">
            <div className="flex justify-between py-2">
              <span>Annual Plan</span>
              <span className="font-semibold">€30/year</span>
            </div>
            <div className="text-sm text-gray-600 py-2">
              5% discount vs. monthly pricing
            </div>
          </div>
        </div>

        {isActive ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="text-sm font-semibold text-green-700">Active</div>
            <div className="text-sm text-gray-600 mt-2">
              {daysRemaining > 0 ? (
                <>
                  Expires in <span className="font-semibold">{daysRemaining}</span> days
                </>
              ) : (
                "Subscription expired"
              )}
            </div>
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="text-sm font-semibold text-yellow-700">
              No Active Subscription
            </div>
            <div className="text-sm text-gray-600 mt-2">
              Subscribe to unlock premium features
            </div>
          </div>
        )}

        <button
          onClick={handleCheckout}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition"
        >
          {loading ? "Processing..." : isActive ? "Renew Subscription" : "Subscribe Now"}
        </button>

        {message && (
          <div className="mt-4 text-sm text-red-600 text-center">{message}</div>
        )}
      </div>
    </div>
  );
}
