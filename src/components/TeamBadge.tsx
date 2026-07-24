import { useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { signedUrl } from "@/lib/storage";

export function TeamBadge({
  name,
  logoPath,
  size = 32,
  color,
}: {
  name: string;
  logoPath?: string | null;
  size?: number;
  color?: string | null;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (logoPath) signedUrl("team-logos", logoPath).then((u) => active && setUrl(u));
    return () => { active = false; };
  }, [logoPath]);

  if (url) {
    return <img src={url} alt={name} className="rounded-full object-cover ring-1 ring-border" style={{ width: size, height: size }} />;
  }
  const initials = name.split(" ").slice(0, 2).map((s) => s[0]).join("").toUpperCase();
  return (
    <div
      className="grid place-items-center rounded-full text-xs font-black text-white ring-1 ring-border"
      style={{ width: size, height: size, background: color || "var(--color-primary)" }}
    >
      {initials || <Shield className="h-4 w-4" />}
    </div>
  );
}
