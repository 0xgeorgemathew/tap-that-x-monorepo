import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = {
  width: 32,
  height: 32,
};

export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: "20%",
        }}
      >
        {/* NFC waves */}
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M 11.2 16 Q 11.2 11.2 16 11.2"
            stroke="white"
            stroke-width="1.5"
            stroke-linecap="round"
            opacity="0.4"
          />
          <path d="M 8.8 16 Q 8.8 8.8 16 8.8" stroke="white" stroke-width="1.5" stroke-linecap="round" opacity="0.6" />
          <path d="M 6.4 16 Q 6.4 6.4 16 6.4" stroke="white" stroke-width="1.5" stroke-linecap="round" opacity="0.8" />
          {/* X symbol */}
          <line x1="13" y1="18.5" x2="19" y2="24.5" stroke="white" stroke-width="2" stroke-linecap="round" />
          <line x1="19" y1="18.5" x2="13" y2="24.5" stroke="white" stroke-width="2" stroke-linecap="round" />
        </svg>
      </div>
    ),
    {
      ...size,
    },
  );
}
