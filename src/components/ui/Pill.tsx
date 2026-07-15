export function Pill({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <span
      className="inline-block rounded-lg px-2.5 py-1 text-[10.5px] font-extrabold"
      style={{ background: bg, color: fg }}
    >
      {label}
    </span>
  );
}
