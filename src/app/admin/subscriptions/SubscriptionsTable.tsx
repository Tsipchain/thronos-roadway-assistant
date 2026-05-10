"use client";

import { useState } from "react";
import Link from "next/link";

interface Subscription {
  id: string;
  name: string;
  slug: string;
  plan: string;
  planActiveUntil: Date | null;
  status: string;
  stripeCustomerId: string | null;
  email: string | null;
  _count: {
    technicians: number;
    requests: number;
  };
}

interface Props {
  subscriptions: Subscription[];
}

export default function SubscriptionsTable({ subscriptions }: Props) {
  const [sortBy, setSortBy] = useState<"name" | "expiry" | "plan">("name");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "expired" | "expiring">("all");

  const now = new Date();

  const getStatus = (planActiveUntil: Date | null) => {
    if (!planActiveUntil) return { status: "INACTIVE", color: "bg-gray-500/20 text-gray-300" };
    if (planActiveUntil <= now) return { status: "EXPIRED", color: "bg-red-500/20 text-red-300" };

    const daysUntilExpiry = (planActiveUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (daysUntilExpiry <= 7) {
      return { status: "EXPIRING SOON", color: "bg-amber-500/20 text-amber-300" };
    }
    return { status: "ACTIVE", color: "bg-green-500/20 text-green-300" };
  };

  const getDaysUntilExpiry = (planActiveUntil: Date | null) => {
    if (!planActiveUntil) return null;
    const days = Math.ceil((planActiveUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  let filtered = subscriptions.filter((sub) => {
    const { status } = getStatus(sub.planActiveUntil);
    if (filterStatus === "all") return true;
    if (filterStatus === "active") return status === "ACTIVE";
    if (filterStatus === "expired") return status === "EXPIRED" || status === "INACTIVE";
    if (filterStatus === "expiring") return status === "EXPIRING SOON";
    return true;
  });

  if (sortBy === "expiry") {
    filtered.sort((a, b) => {
      const aDate = a.planActiveUntil?.getTime() ?? 0;
      const bDate = b.planActiveUntil?.getTime() ?? 0;
      return aDate - bDate;
    });
  } else if (sortBy === "plan") {
    filtered.sort((a, b) => a.plan.localeCompare(b.plan));
  } else {
    filtered.sort((a, b) => a.name.localeCompare(b.name));
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
      <div className="flex items-center gap-4 mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setFilterStatus("all")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filterStatus === "all"
                ? "bg-indigo-500 text-white"
                : "bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterStatus("active")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filterStatus === "active"
                ? "bg-green-500 text-white"
                : "bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setFilterStatus("expiring")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filterStatus === "expiring"
                ? "bg-amber-500 text-white"
                : "bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            Expiring Soon
          </button>
          <button
            onClick={() => setFilterStatus("expired")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filterStatus === "expired"
                ? "bg-red-500 text-white"
                : "bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            Expired
          </button>
        </div>

        <div className="ml-auto">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="name">Sort by Name</option>
            <option value="expiry">Sort by Expiry Date</option>
            <option value="plan">Sort by Plan</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <div className="text-4xl mb-3">🤔</div>
          <p>No subscriptions match your filter.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-white/10 text-left">
                <th className="pb-3">Company</th>
                <th className="pb-3">Plan</th>
                <th className="pb-3">Expires</th>
                <th className="pb-3 text-center">Status</th>
                <th className="pb-3 text-center">Techs</th>
                <th className="pb-3 text-center">Jobs</th>
                <th className="pb-3">Stripe</th>
                <th className="pb-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((sub) => {
                const { status, color } = getStatus(sub.planActiveUntil);
                const daysUntil = getDaysUntilExpiry(sub.planActiveUntil);
                const expiryDisplay = sub.planActiveUntil
                  ? sub.planActiveUntil.toLocaleDateString("el-GR", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })
                  : "Never";

                return (
                  <tr key={sub.id} className="border-b border-white/5 hover:bg-white/5 transition">
                    <td className="py-3 font-medium">{sub.name}</td>
                    <td className="py-3">
                      <span className="bg-purple-500/20 text-purple-300 text-xs px-2 py-1 rounded-full">
                        {sub.plan}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="text-slate-300">{expiryDisplay}</div>
                      {daysUntil !== null && (
                        <div className={`text-xs ${daysUntil < 0 ? "text-red-400" : "text-slate-500"}`}>
                          {daysUntil < 0
                            ? `${Math.abs(daysUntil)} days ago`
                            : daysUntil === 0
                            ? "Today"
                            : `${daysUntil} days left`}
                        </div>
                      )}
                    </td>
                    <td className="py-3 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full ${color}`}>
                        {status}
                      </span>
                    </td>
                    <td className="py-3 text-center text-slate-300">{sub._count.technicians}</td>
                    <td className="py-3 text-center text-slate-300">{sub._count.requests}</td>
                    <td className="py-3">
                      {sub.stripeCustomerId ? (
                        <span className="text-xs text-slate-400 font-mono">{sub.stripeCustomerId.substring(0, 10)}...</span>
                      ) : (
                        <span className="text-xs text-slate-600">Not configured</span>
                      )}
                    </td>
                    <td className="py-3">
                      <Link
                        href={`/admin/subscriptions/${sub.id}`}
                        className="text-indigo-400 hover:text-indigo-300 text-xs font-medium"
                      >
                        Manage →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
