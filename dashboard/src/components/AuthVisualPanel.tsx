/** Decorative right-hand panel for the auth pages -- pure CSS/SVG (no external image
 *  assets), evoking commit/threshold graphs rather than literal artwork. */
export function AuthVisualPanel() {
  return (
    <div className="relative hidden overflow-hidden bg-black lg:block">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(circle at 70% 30%, rgba(52,211,153,0.18), transparent 55%)",
        }}
      />
      <svg
        viewBox="0 0 400 300"
        className="absolute right-0 bottom-0 h-2/3 w-2/3 text-emerald-400/70"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <polyline points="0,220 60,180 110,200 160,120 210,150 260,60 310,90 360,30" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="160" cy="120" r="5" fill="currentColor" stroke="none" />
        <circle cx="260" cy="60" r="5" fill="currentColor" stroke="none" />
        <circle cx="360" cy="30" r="5" fill="currentColor" stroke="none" />
      </svg>
      <div className="absolute bottom-10 left-10 max-w-xs">
        <p className="text-xs font-medium text-white/50">Threshold</p>
        <p className="mt-1 text-lg font-medium text-white/90">
          CARF watches every commit and rolls back the risky ones before they page anyone.
        </p>
      </div>
    </div>
  );
}
