import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "BubbleIn - Creators B2B no LinkedIn";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #0B0B1A 0%, #1E1E3A 50%, #0B0B1A 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "24px",
          }}
        >
          <div
            style={{
              fontSize: "72px",
              fontWeight: 800,
              background: "linear-gradient(135deg, #E91E8C, #C724D1)",
              backgroundClip: "text",
              color: "transparent",
              letterSpacing: "-2px",
            }}
          >
            BubbleIn
          </div>
          <div
            style={{
              fontSize: "32px",
              color: "#ffffff",
              fontWeight: 600,
              textAlign: "center",
              maxWidth: "800px",
            }}
          >
            Creators B2B no LinkedIn
          </div>
          <div
            style={{
              fontSize: "20px",
              color: "#adaaaa",
              textAlign: "center",
              maxWidth: "700px",
              lineHeight: 1.5,
            }}
          >
            Conectamos sua marca a creators relevantes que geram confiança, demanda e resultados reais.
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            bottom: "40px",
            fontSize: "16px",
            color: "#E91E8C",
          }}
        >
          bubblein.com.br
        </div>
      </div>
    ),
    { ...size }
  );
}
