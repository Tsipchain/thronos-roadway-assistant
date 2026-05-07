"use client";
export const dynamic = 'force-dynamic';

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";

interface TeamMember {
  id: string;
  name: string;
  totalEarned: number;
}

interface RewardTx {
  id: string;
  memberId: string;
  member: { name: string; email?: string; thrAddress?: string };
  amount: number;
  reason: string;
  status: string;
  createdAt: string;
}

interface RewardStats {
  totalPending: number;
  totalDistributed: number;
  activeMemberCount: number;
}

export default function RewardsPage() {
  const { data: session, status } = useSession();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [history, setHistory] = useState<RewardTx[]>([]);
  const [stats, setStats] = useState<RewardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    memberId: "",
    amount: "",
    reason: "",
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/auth/signin");
    }

    if (status === "authenticated") {
      fetchData();
    }
  }, [status]);

  const fetchData = async () => {
    try {
      const [membersRes, historyRes, statsRes] = await Promise.all([
        fetch("/api/admin/team"),
        fetch("/api/admin/rewards?metric=history"),
        fetch("/api/admin/rewards?metric=stats"),
      ]);

      if (membersRes.ok) {
        const data = await membersRes.json();
        setMembers(data.members);
        if (formData.memberId === "" && data.members.length > 0) {
          setFormData({ ...formData, memberId: data.members[0].id });
        }
      }

      if (historyRes.ok) {
        const data = await historyRes.json();
        setHistory(data.history);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.memberId || !formData.amount || !formData.reason) {
      alert("Please fill in all fields");
      return;
    }

    try {
      const res = await fetch("/api/admin/rewards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: formData.memberId,
          amount: parseFloat(formData.amount),
          reason: formData.reason,
        }),
      });

      if (res.ok) {
        await fetchData();
        setShowForm(false);
        setFormData({
          memberId: members[0]?.id || "",
          amount: "",
          reason: "",
        });
      }
    } catch (error) {
      console.error("Failed to distribute reward:", error);
    }
  };

  if (status === "loading" || loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Reward Distribution</h1>
            <p className="text-gray-600 mt-2">Manage technician payouts and rewards</p>
          </div>
          <div className="space-x-4">
            <Link href="/admin/dashboard" className="text-blue-600 hover:underline">
              ← Back
            </Link>
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition"
            >
              {showForm ? "Cancel" : "+ Distribute"}
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-600">Pending Distribution</div>
              <div className="mt-2 text-3xl font-bold">€{stats.totalPending.toFixed(2)}</div>
              <div className="text-xs text-gray-500 mt-1">Awaiting payout</div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-600">Total Distributed</div>
              <div className="mt-2 text-3xl font-bold">€{stats.totalDistributed.toFixed(2)}</div>
              <div className="text-xs text-gray-500 mt-1">All time</div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-600">Active Members</div>
              <div className="mt-2 text-3xl font-bold">{stats.activeMemberCount}</div>
              <div className="text-xs text-gray-500 mt-1">Team members</div>
            </div>
          </div>
        )}

        {/* Distribute Form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">Distribute Rewards</h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Team Member*</label>
                <select
                  value={formData.memberId}
                  onChange={(e) =>
                    setFormData({ ...formData, memberId: e.target.value })
                  }
                  className="w-full border rounded-lg p-2"
                  required
                >
                  <option value="">Select a member</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} (€{m.totalEarned.toFixed(2)} earned)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Amount (€)*</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: e.target.value })
                  }
                  className="w-full border rounded-lg p-2"
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Reason*</label>
                <select
                  value={formData.reason}
                  onChange={(e) =>
                    setFormData({ ...formData, reason: e.target.value })
                  }
                  className="w-full border rounded-lg p-2"
                  required
                >
                  <option value="">Select reason</option>
                  <option value="weekly_earnings">Weekly Earnings</option>
                  <option value="monthly_bonus">Monthly Bonus</option>
                  <option value="performance_incentive">Performance Incentive</option>
                  <option value="referral_bonus">Referral Bonus</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <button
                type="submit"
                className="md:col-span-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg transition"
              >
                Distribute Reward
              </button>
            </form>
          </div>
        )}

        {/* History Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold">Distribution History</h2>
          </div>

          {history.length === 0 ? (
            <div className="p-6 text-center text-gray-600">No distributions yet</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Member</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Amount</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Reason</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {history.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium">{tx.member.name}</div>
                      {tx.member.thrAddress && (
                        <div className="text-xs text-gray-600 font-mono">
                          {tx.member.thrAddress.slice(0, 10)}...
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 font-semibold">€{tx.amount.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm">{tx.reason}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                          tx.status === "COMPLETED"
                            ? "bg-green-100 text-green-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
