import { fontFamily, loadFont } from "@remotion/google-fonts/Inter";
import { AbsoluteFill } from "remotion";
import { PhoneFrame } from "./PhoneFrame";

loadFont("normal", { subsets: ["latin"], weights: ["500", "800"] });

const CHIPS = ["Claude Code", "Remotion", "Next.js", "React Native"];

export const AiProofPoster: React.FC = () => (
  <AbsoluteFill
    style={{
      fontFamily,
      background: "linear-gradient(135deg,#053b22 0%,#0a7a3f 100%)",
      color: "#fff",
      flexDirection: "row",
      alignItems: "center",
      padding: "0 90px",
      gap: 60,
    }}
  >
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 30, fontWeight: 500, opacity: 0.8 }}>
        REAL AI WORKFLOW
      </div>
      <div
        style={{
          fontSize: 96,
          fontWeight: 800,
          lineHeight: 1.05,
          margin: "20px 0",
        }}
      >
        Streefi, built with AI
      </div>
      <div style={{ fontSize: 36, opacity: 0.9, lineHeight: 1.35 }}>
        Street-food discovery app: live vendor map, search &amp; deals. Screens,
        features and this proof video were all shipped with AI tooling.
      </div>
      <div
        style={{ display: "flex", gap: 14, marginTop: 40, flexWrap: "wrap" }}
      >
        {CHIPS.map((c) => (
          <span
            key={c}
            style={{
              fontSize: 28,
              fontWeight: 500,
              padding: "10px 22px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.16)",
            }}
          >
            {c}
          </span>
        ))}
      </div>
    </div>
    <div style={{ display: "flex", gap: 30, alignItems: "center" }}>
      <PhoneFrame
        src="new1.png"
        width={300}
        style={{ transform: "translateY(40px)" }}
      />
      <PhoneFrame src="new2.png" width={340} />
      <PhoneFrame
        src="new3.png"
        width={300}
        style={{ transform: "translateY(-40px)" }}
      />
    </div>
  </AbsoluteFill>
);
