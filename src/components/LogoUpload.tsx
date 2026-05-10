"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface Props {
  tenantSlug: string;
  initialLogo: string | null;
  tenantName: string;
}

export default function LogoUpload({ tenantSlug, initialLogo, tenantName }: Props) {
  const router = useRouter();
  const [logo, setLogo] = useState(initialLogo);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith("image/")) {
      setMessage("❌ Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage("❌ File is too large (max 5MB)");
      return;
    }

    setUploading(true);
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/t/${tenantSlug}/logo`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setLogo(data.logoUrl);
        setMessage("✓ Logo uploaded successfully");
        if (fileInputRef.current) fileInputRef.current.value = "";
        router.refresh();
      } else {
        setMessage(`❌ ${data.message || "Upload failed"}`);
      }
    } catch (error) {
      setMessage("❌ Failed to upload logo");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
      <h2 className="text-lg font-semibold mb-6">Company Logo</h2>

      {message && (
        <div className="mb-4 p-3 rounded-lg bg-slate-900/50 border border-slate-700 text-sm">
          {message}
        </div>
      )}

      <div className="flex flex-col gap-6">
        {/* Current Logo Preview */}
        <div className="flex items-center gap-6">
          <div className="shrink-0">
            {logo ? (
              <div className="relative w-24 h-24 bg-slate-800 rounded-xl overflow-hidden border border-white/10">
                <img
                  src={logo}
                  alt={tenantName}
                  className="w-full h-full object-contain p-2"
                />
              </div>
            ) : (
              <div className="w-24 h-24 rounded-xl bg-amber-600 flex items-center justify-center text-3xl font-bold shadow-lg shadow-amber-900/30">
                {tenantName[0]}
              </div>
            )}
          </div>

          <div>
            <p className="text-sm text-slate-400 mb-3">
              {logo ? "Current logo" : "No logo set"}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-500/50 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
              >
                {uploading ? "Uploading..." : "📤 Upload Logo"}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-3">
              PNG, JPG, WebP · Max 5MB
            </p>
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          disabled={uploading}
        />

        {/* Info */}
        <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
          <div className="text-xs text-slate-400 space-y-1">
            <p className="font-medium text-slate-300 mb-2">About the logo:</p>
            <ul className="space-y-1 ml-4">
              <li>• Used in customer-facing interfaces and branding</li>
              <li>• Recommended size: 256×256 px or larger</li>
              <li>• PNG with transparency recommended</li>
              <li>• Square or landscape aspect ratio works best</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
