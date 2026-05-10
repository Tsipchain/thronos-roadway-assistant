"use client";

import { useState } from "react";
import { PartnerCompany } from "@prisma/client";

interface Props {
  companyId: string;
  company: PartnerCompany & {
    _count: {
      technicians: number;
      requests: number;
      users: number;
    };
  };
}

export default function ManageSubscriptionForm({ companyId, company }: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [extendDays, setExtendDays] = useState(30);
  const [autoRenewal, setAutoRenewal] = useState(true);

  const handleExtendSubscription = async () => {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/subscriptions/extend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          daysToAdd: extendDays,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage("✓ Subscription extended successfully. Reload page to see changes.");
      } else {
        setMessage(`✗ Error: ${data.message || "Failed to extend subscription"}`);
      }
    } catch (error) {
      setMessage("✗ Failed to extend subscription");
    } finally {
      setLoading(false);
    }
  };

  const handleResetExpiredStatus = async () => {
    if (!confirm("Reset the 'expired' block flag? Tenant will regain service access.")) return;

    setLoading(true);
    setMessage("");

    try {
      const now = new Date();
      const newExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const response = await fetch("/api/admin/subscriptions/extend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          daysToAdd: 30,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage("✓ Subscription reset. Service access restored for 30 days.");
      } else {
        setMessage(`✗ Error: ${data.message || "Failed to reset subscription"}`);
      }
    } catch (error) {
      setMessage("✗ Failed to reset subscription");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAutoRenewal = async () => {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/subscriptions/auto-renewal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          enabled: !autoRenewal,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setAutoRenewal(!autoRenewal);
        setMessage(`✓ Auto-renewal ${!autoRenewal ? "enabled" : "disabled"}`);
      } else {
        setMessage(`✗ Error: ${data.message || "Failed to update auto-renewal"}`);
      }
    } catch (error) {
      setMessage("✗ Failed to update auto-renewal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
      <h2 className="text-lg font-semibold mb-6">Manage Subscription</h2>

      {message && (
        <div className="mb-6 p-4 rounded-lg bg-slate-900/50 border border-slate-700 text-sm">
          {message}
        </div>
      )}

      <div className="space-y-6">

        {/* Extend Subscription */}
        <div className="border-t border-white/10 pt-6">
          <h3 className="font-medium mb-4">Extend Subscription</h3>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm text-slate-400 mb-2">Days to Add</label>
              <input
                type="number"
                min="1"
                max="365"
                value={extendDays}
                onChange={(e) => setExtendDays(parseInt(e.target.value))}
                className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <button
              onClick={handleExtendSubscription}
              disabled={loading}
              className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-500/50 text-white font-medium px-6 py-2 rounded-lg transition"
            >
              {loading ? "Processing..." : "Extend"}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Adds time to the current subscription. Can be used to override auto-renewal delays.
          </p>
        </div>

        {/* Emergency Reset */}
        {(!company.planActiveUntil || company.planActiveUntil <= new Date()) && (
          <div className="border-t border-white/10 pt-6">
            <h3 className="font-medium mb-4">Emergency: Restore Service</h3>
            <button
              onClick={handleResetExpiredStatus}
              disabled={loading}
              className="bg-green-600/30 hover:bg-green-600/50 border border-green-500/50 text-green-300 font-medium px-6 py-2 rounded-lg transition"
            >
              {loading ? "Processing..." : "Grant 30-Day Extension"}
            </button>
            <p className="text-xs text-slate-500 mt-2">
              Immediately restores service for 30 days if expired. Use for emergency situations.
            </p>
          </div>
        )}

        {/* Auto-Renewal Status */}
        <div className="border-t border-white/10 pt-6">
          <h3 className="font-medium mb-4">Auto-Renewal Settings</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">Automatic renewal via Stripe</p>
              <p className="text-xs text-slate-500 mt-1">
                {autoRenewal
                  ? "Subscription will auto-renew at Stripe when planActiveUntil expires"
                  : "Automatic renewal is disabled"}
              </p>
            </div>
            <button
              onClick={handleToggleAutoRenewal}
              disabled={loading}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                autoRenewal
                  ? "bg-green-500/20 text-green-300 border border-green-500/50"
                  : "bg-red-500/20 text-red-300 border border-red-500/50"
              } disabled:opacity-50`}
            >
              {autoRenewal ? "Enabled" : "Disabled"}
            </button>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 mt-6">
          <div className="text-xs text-slate-400 space-y-1">
            <p className="font-medium text-slate-300 mb-2">Service Blocking Logic:</p>
            <ul className="space-y-1 ml-4">
              <li>✓ If planActiveUntil &gt; now: Service ACTIVE</li>
              <li>✓ If planActiveUntil ≤ now AND now - planActiveUntil ≤ 2 days: Service WARNING</li>
              <li>✓ If now - planActiveUntil &gt; 2 days: Service BLOCKED</li>
            </ul>
            <p className="mt-3">Technicians cannot dispatch, and customers cannot request service when blocked.</p>
          </div>
        </div>

      </div>
    </div>
  );
}
