import Link from "next/link";
import { type LucideIcon } from "lucide-react";

export default function ToolCard({
  href,
  title,
  desc,
  Icon
}: {
  href: string;
  title: string;
  desc: string;
  Icon: LucideIcon;
}) {
  return (
    <Link href={href} className="neon-edge rounded-xl card p-4 transition">
      <div className="flex items-start gap-3">
        <div className="rounded-md border border-[var(--border)] bg-[color:var(--accent-weak)] p-2">
          <Icon size={20} className="text-[var(--accent)]" />
        </div>
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">{desc}</p>
        </div>
      </div>
    </Link>
  );
}
