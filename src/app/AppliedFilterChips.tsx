"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

function Chip({ label, href }: { label: string; href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-sm hover:bg-gray-50"
    >
      {label} <span className="text-gray-500">✕</span>
    </Link>
  );
}

function buildHrefWithout(sp: URLSearchParams, key: string, valueToRemove?: string) {
  const params = new URLSearchParams(sp.toString());

  if (valueToRemove && key === "tags") {
    const raw = (params.get("tags") ?? "").trim();
    const parts = raw.split(",").map((x) => x.trim()).filter(Boolean);
    const next = parts.filter((t) => t !== valueToRemove);
    if (next.length) params.set("tags", next.join(","));
    else params.delete("tags");
  } else {
    params.delete(key);
  }

  params.set("page", "1");
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

export default function AppliedFilterChips() {
  const sp = useSearchParams();

  const q = (sp.get("q") ?? "").trim();
  const driver = sp.get("driver") ?? "any";
  const dbs = sp.get("dbs") ?? "any";
  const training = sp.get("training") ?? "any";
  const status = sp.get("status") ?? "any";
  const weekend = sp.get("weekend") ?? "any";

  const tagsRaw = (sp.get("tags") ?? "").trim();
  const tags = tagsRaw
    ? tagsRaw.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean)
    : [];

  const sort = (sp.get("sort") ?? "").trim();
  const dir = (sp.get("dir") ?? "").trim();

  const chips: Array<{ label: string; href: string }> = [];

  if (q) chips.push({ label: `q: ${q}`, href: buildHrefWithout(sp, "q") });
  if (driver !== "any") chips.push({ label: `Driver: ${driver}`, href: buildHrefWithout(sp, "driver") });
  if (dbs !== "any") chips.push({ label: `DBS: ${dbs}`, href: buildHrefWithout(sp, "dbs") });
  if (training !== "any") chips.push({ label: `Training: ${training}`, href: buildHrefWithout(sp, "training") });
  if (status !== "any") chips.push({ label: `Status: ${status}`, href: buildHrefWithout(sp, "status") });
  if (weekend !== "any") chips.push({ label: `Weekend: ${weekend}`, href: buildHrefWithout(sp, "weekend") });

  for (const t of tags) chips.push({ label: `Tag: ${t}`, href: buildHrefWithout(sp, "tags", t) });

  if (sort) chips.push({ label: `Sort: ${sort}${dir ? ` (${dir})` : ""}`, href: buildHrefWithout(sp, "sort") });

  if (!chips.length) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {chips.map((c, i) => (
        <Chip key={`${c.label}-${i}`} label={c.label} href={c.href} />
      ))}
    </div>
  );
}
