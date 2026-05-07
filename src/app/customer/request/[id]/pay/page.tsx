"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { redirect, useParams } from "next/navigation";
import { loadStripe } from "@stripe/js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
);

interface ServiceRequest {
  id: string;
  status: string;
  estimatedPrice: number;
  finalPrice: number | null;
}

function PaymentForm({
  requestId,
  amount,
  onSuccess,
}: {
  requestId: string;
  amount: number;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCardPayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setLoading(true);
    setError("");

    try {
      // Get payment intent
      const res = await fetch("/api/payment/card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, amount }),
      });

      if (!res.ok) {
        throw new Error("Failed to create payment intent");
      }

      const { clientSecret } = await res.json();

      // Confirm payment
      const cardElement = elements.getElement(CardElement);
      const { error: stripeError, paymentIntent } =
        await stripe.confirmCardPayment(clientSecret, {
          payment_method: {
            card: cardElement!,
            billing_details: {},
          },
        });

      if (stripeError) {
        setError(stripeError.message || "Payment failed");
      } else if (paymentIntent?.status === "succeeded") {
        onSuccess();
      } else {
        setError("Payment was not successful");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleCardPayment} className="space-y-4">
      <CardElement
        options={{
          style: {
            base: {
              fontSize: "16px",
              color: "#424770",
              "::placeholder": {
                color: "#aab7c4",
              },
            },
            invalid: {
              color: "#9e2146",
            },
          },
        }}
      />
      {error && <div className="text-red-600 text-sm">{error}</div>}
      <button
        type="submit"
        disabled={loading || !stripe}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition"
      >
        {loading ? "Processing..." : `Pay €${amount.toFixed(2)}`}
      </button>
    </form>
  );
}

export default function PaymentPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const requestId = params?.id as string;

  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "crypto" | null>(
    null
  );
  const [cryptoEscrow, setCryptoEscrow] = useState<{
    escrowAddress: string;
    expiresAt: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/auth/signin");
    }

    if (status === "authenticated" && requestId) {
      fetchRequest();
    }
  }, [status, requestId]);

  const fetchRequest = async () => {
    try {
      const res = await fetch(`/api/service-requests/${requestId}`);
      if (res.ok) {
        const data = await res.json();
        setRequest(data.request);
      }
    } catch (error) {
      console.error("Failed to fetch request:", error);
    }
  };

  const handleCryptoPayment = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/thronos/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          action: "initiate",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCryptoEscrow({
          escrowAddress: data.escrowAddress,
          expiresAt: data.expiresAt,
        });
        setMessage("Escrow created. Send funds to the address above.");
      } else {
        setMessage("Failed to initiate crypto payment");
      }
    } catch (error) {
      console.error("Crypto payment error:", error);
      setMessage("Crypto payment failed");
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || !request) {
    return <div>Loading...</div>;
  }

  const amount = request.finalPrice || request.estimatedPrice;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-6">Payment</h1>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between mb-4">
            <span>Amount</span>
            <span className="font-semibold text-lg">€{amount.toFixed(2)}</span>
          </div>
          <div className="text-sm text-gray-600">
            Request Status: <span className="font-semibold">{request.status}</span>
          </div>
        </div>

        {!paymentMethod ? (
          <div className="space-y-4">
            <h2 className="font-semibold text-lg">Choose Payment Method</h2>

            <button
              onClick={() => setPaymentMethod("card")}
              className="w-full border-2 border-gray-300 hover:border-blue-600 rounded-lg p-4 text-left transition"
            >
              <div className="font-semibold">💳 Card Payment</div>
              <div className="text-sm text-gray-600">Visa, Mastercard, etc.</div>
            </button>

            <button
              onClick={() => setPaymentMethod("crypto")}
              className="w-full border-2 border-gray-300 hover:border-blue-600 rounded-lg p-4 text-left transition"
            >
              <div className="font-semibold">₿ Crypto Payment</div>
              <div className="text-sm text-gray-600">Via Thronos blockchain</div>
            </button>
          </div>
        ) : paymentMethod === "card" ? (
          <div className="bg-white rounded-lg shadow p-6">
            <button
              onClick={() => setPaymentMethod(null)}
              className="text-blue-600 text-sm mb-4"
            >
              ← Change method
            </button>
            <Elements stripe={stripePromise}>
              <PaymentForm
                requestId={requestId}
                amount={amount}
                onSuccess={() => {
                  setMessage("Payment successful!");
                  redirect(`/customer/request/${requestId}`);
                }}
              />
            </Elements>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-6">
            <button
              onClick={() => {
                setPaymentMethod(null);
                setCryptoEscrow(null);
              }}
              className="text-blue-600 text-sm mb-4"
            >
              ← Change method
            </button>

            {!cryptoEscrow ? (
              <button
                onClick={handleCryptoPayment}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                {loading ? "Creating escrow..." : "Create Escrow"}
              </button>
            ) : (
              <div className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                  <div className="font-semibold text-sm mb-2">Escrow Address</div>
                  <div className="font-mono text-xs break-all bg-white p-2 rounded border border-yellow-300">
                    {cryptoEscrow.escrowAddress}
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  Send €{amount.toFixed(2)} equivalent to this address
                </div>
                <div className="text-xs text-red-600">
                  Expires at {new Date(cryptoEscrow.expiresAt).toLocaleString()}
                </div>
              </div>
            )}
          </div>
        )}

        {message && (
          <div className="mt-4 text-sm text-center text-gray-600">{message}</div>
        )}
      </div>
    </div>
  );
}
