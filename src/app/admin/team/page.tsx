"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";

interface TeamMember {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  role: string;
  isActive: boolean;
  totalEarned: number;
  thrAddress?: string;
  thrBalance: number;
  specialties?: string[];
}

export default function TeamPage() {
  const { data: session, status } = useSession();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMember, setNewMember] = useState({
    name: "",
    phone: "",
    email: "",
    role: "EMPLOYEE",
    thrAddress: "",
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/auth/signin");
    }

    if (status === "authenticated") {
      fetchTeam();
    }
  }, [status]);

  const fetchTeam = async () => {
    try {
      const res = await fetch("/api/admin/team");
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members);
      }
    } catch (error) {
      console.error("Failed to fetch team:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await fetch("/api/admin/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newMember),
      });

      if (res.ok) {
        await fetchTeam();
        setNewMember({ name: "", phone: "", email: "", role: "EMPLOYEE", thrAddress: "" });
        setShowAddForm(false);
      }
    } catch (error) {
      console.error("Failed to add member:", error);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Are you sure?")) return;

    try {
      await fetch("/api/admin/team", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });

      await fetchTeam();
    } catch (error) {
      console.error("Failed to remove member:", error);
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
            <h1 className="text-3xl font-bold">Team Management</h1>
            <p className="text-gray-600 mt-2">{members.length} team members</p>
          </div>
          <div className="space-x-4">
            <Link
              href="/admin/dashboard"
              className="text-blue-600 hover:underline"
            >
              ← Back
            </Link>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition"
            >
              {showAddForm ? "Cancel" : "+ Add Member"}
            </button>
          </div>
        </div>

        {/* Add Member Form */}
        {showAddForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">Add Team Member</h2>
            <form onSubmit={handleAddMember} className="grid grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Name"
                value={newMember.name}
                onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                className="col-span-2 border rounded-lg p-2"
                required
              />
              <input
                type="tel"
                placeholder="Phone"
                value={newMember.phone}
                onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })}
                className="border rounded-lg p-2"
              />
              <input
                type="email"
                placeholder="Email"
                value={newMember.email}
                onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                className="border rounded-lg p-2"
              />
              <select
                value={newMember.role}
                onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
                className="col-span-2 border rounded-lg p-2"
              >
                <option value="EMPLOYEE">Employee</option>
                <option value="CONTRACTOR">Contractor</option>
                <option value="PARTNER">Partner</option>
                <option value="MANAGER">Manager</option>
              </select>
              <input
                type="text"
                placeholder="Thronos Address (THR...)"
                value={newMember.thrAddress}
                onChange={(e) => setNewMember({ ...newMember, thrAddress: e.target.value })}
                className="col-span-2 border rounded-lg p-2"
              />
              <button
                type="submit"
                className="col-span-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg transition"
              >
                Add Member
              </button>
            </form>
          </div>
        )}

        {/* Team List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold">Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Role</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Contact</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Earned</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
                <th className="px-6 py-3 text-right text-sm font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium">{member.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{member.role}</td>
                  <td className="px-6 py-4 text-sm">
                    {member.phone && <div>{member.phone}</div>}
                    {member.email && <div className="text-gray-600">{member.email}</div>}
                  </td>
                  <td className="px-6 py-4 font-semibold">
                    €{member.totalEarned.toFixed(2)}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                        member.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {member.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      className="text-red-600 hover:underline text-sm"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
