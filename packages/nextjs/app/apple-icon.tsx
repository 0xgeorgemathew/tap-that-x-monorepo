import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#6366F1",
          borderRadius: "22.5%",
        }}
      >
        <svg width="180" height="180" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* NFC waves */}
          <path d="M 63 90 Q 63 63 90 63" stroke="white" stroke-width="8.5" stroke-linecap="round" opacity="0.4" />
          <path
            d="M 49.5 90 Q 49.5 49.5 90 49.5"
            stroke="white"
            stroke-width="8.5"
            stroke-linecap="round"
            opacity="0.6"
          />
          <path d="M 36 90 Q 36 36 90 36" stroke="white" stroke-width="8.5" stroke-linecap="round" opacity="0.8" />
          {/* X symbol */}
          <line x1="76" y1="104" x2="104" y2="132" stroke="white" stroke-width="11" stroke-linecap="round" />
          <line x1="104" y1="104" x2="76" y2="132" stroke="white" stroke-width="11" stroke-linecap="round" />
        </svg>
      </div>
    ),
    {
      ...size,
    },
  );
}
