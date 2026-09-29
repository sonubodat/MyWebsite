import { fontFamily, loadFont } from "@remotion/google-fonts/Inter";
import {
  AbsoluteFill,
  interpolate,
  Series,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PhoneFrame } from "./PhoneFrame";

loadFont("normal", { subsets: ["latin"], weights: ["500", "800"] });

const SCENE = 90; // 3s @30fps
export const AI_PROOF_DURATION = SCENE * 5;

const BG = "linear-gradient(160deg,#053b22 0%,#0a7a3f 100%)";

const Scene: React.FC<{
  title: string;
  caption: string;
  src: string;
}> = ({ title, caption, src }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 } });
  const out = interpolate(frame, [SCENE - 10, SCENE], [1, 0], {
    extrapolateLeft: "clamp",
  });
  return (
    <AbsoluteFill
      style={{ background: BG, alignItems: "center", opacity: out }}
    >
      <div
        style={{
          marginTop: 110,
          color: "#fff",
          textAlign: "center",
          padding: "0 70px",
          opacity: enter,
          transform: `translateY(${(1 - enter) * 40}px)`,
        }}
      >
        <div style={{ fontSize: 76, fontWeight: 800 }}>{title}</div>
        <div style={{ fontSize: 40, opacity: 0.85, marginTop: 16 }}>
          {caption}
        </div>
      </div>
      <PhoneFrame
        src={src}
        width={640}
        style={{
          marginTop: 70,
          opacity: enter,
          transform: `translateY(${(1 - enter) * 220}px)`,
        }}
      />
    </AbsoluteFill>
  );
};

const Title: React.FC<{ big: string; small: string; lines?: string[] }> = ({
  big,
  small,
  lines = [],
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill
      style={{
        background: BG,
        color: "#fff",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
        padding: "0 80px",
      }}
    >
      <div
        style={{
          fontSize: 34,
          fontWeight: 500,
          opacity: 0.8,
          letterSpacing: 6,
        }}
      >
        {small}
      </div>
      <div
        style={{
          fontSize: 110,
          fontWeight: 800,
          lineHeight: 1.05,
          margin: "24px 0",
        }}
      >
        {big}
      </div>
      {lines.map((l, i) => {
        const p = spring({
          frame: frame - 15 - i * 8,
          fps,
          config: { damping: 200 },
        });
        return (
          <div
            key={l}
            style={{
              fontSize: 44,
              marginTop: 18,
              padding: "16px 34px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.16)",
              opacity: p,
              transform: `scale(${0.9 + 0.1 * p})`,
            }}
          >
            {l}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export const AiProofVideo: React.FC = () => (
  <AbsoluteFill style={{ fontFamily }}>
    <Series>
      <Series.Sequence durationInFrames={SCENE}>
        <Title big="Streefi, built with AI" small="REAL AI WORKFLOW" />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENE}>
        <Scene
          src="new1.png"
          title="Live vendor map"
          caption="AI-assisted map + custom vendor markers"
        />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENE}>
        <Scene
          src="new2.png"
          title="Explore & search"
          caption="AI-generated banners, categories, night cravings"
        />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENE}>
        <Scene
          src="new3.png"
          title="Deals & filters"
          caption="Featured deals, filters, distance - shipped fast"
        />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENE}>
        <Title
          big="Idea to app, faster"
          small="TOOLS"
          lines={["Claude Code", "Remotion", "Next.js + React Native"]}
        />
      </Series.Sequence>
    </Series>
  </AbsoluteFill>
);
