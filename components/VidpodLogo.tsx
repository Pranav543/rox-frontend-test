export function VidpodLogo({
  size = "md",
  muted = false,
}: {
  size?: "sm" | "md";
  muted?: boolean;
}) {
  const text = size === "sm" ? "text-[13px]" : "text-[15px]";
  const icon = size === "sm" ? "h-[18px] w-[18px]" : "h-6 w-6";
  const color = muted ? "text-[#9ca3af]" : "text-[#111827]";
  return (
    <div className={`flex items-center gap-1.5 ${color}`}>
      <svg
        className={icon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        aria-hidden
      >
        <path d="M12 2L4 20h16L12 2z" />
      </svg>
      <span className={`${text} font-semibold tracking-tight`}>Vidpod</span>
    </div>
  );
}
