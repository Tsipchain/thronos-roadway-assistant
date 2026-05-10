"use client";
import { signOut } from "next-auth/react";

export default function LogoutButton({ className }: { className?: string }) {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className={
        className ??
        "text-sm text-slate-400 hover:text-white border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl transition"
      }
    >
      Αποσύνδεση
    </button>
  );
}
