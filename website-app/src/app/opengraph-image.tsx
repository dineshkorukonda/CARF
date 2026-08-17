import { ImageResponse } from "next/og";

export const alt =
  "CARF — two-tier commit classification driving dynamic canary rollback thresholds";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const stages = [
  { label: "Tier 1", detail: "Path classifier" },
  { label: "Tier 2", detail: "AST structural diff" },
  { label: "Threshold Engine", detail: "Dynamic error ceiling" },
];

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#ffffff",
          padding: "64px 72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              display: "flex",
              background: "#111111",
              color: "#ffffff",
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 4,
              padding: "6px 14px",
              borderRadius: 4,
            }}
          >
            CARF
          </div>
          <div style={{ display: "flex", fontSize: 22, color: "#555555" }}>
            Change-Aware Rollback Framework
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div
            style={{
              display: "flex",
              fontSize: 44,
              fontWeight: 600,
              lineHeight: 1.25,
              letterSpacing: -1,
              color: "#0a0a0a",
              maxWidth: 980,
            }}
          >
            Classifies every commit diff, computes a dynamic canary threshold per change type.
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
            {stages.map((stage, i) => (
              <div key={stage.label} style={{ display: "flex", alignItems: "center" }}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    background: "#fafafa",
                    border: "1px solid #e5e5e5",
                    borderRadius: 6,
                    padding: "14px 20px",
                  }}
                >
                  <div style={{ display: "flex", fontSize: 15, fontWeight: 700, color: "#111111" }}>
                    {stage.label}
                  </div>
                  <div style={{ display: "flex", fontSize: 14, color: "#777777" }}>
                    {stage.detail}
                  </div>
                </div>
                {i < stages.length - 1 && (
                  <div
                    style={{
                      display: "flex",
                      fontSize: 22,
                      color: "#cccccc",
                      padding: "0 14px",
                    }}
                  >
                    →
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 16,
            color: "#999999",
            borderTop: "1px solid #eaeaea",
            paddingTop: 20,
          }}
        >
          Feeds real-time strictness to Argo Rollouts &amp; Flagger via a stable webhook API
        </div>
      </div>
    ),
    { ...size }
  );
}
