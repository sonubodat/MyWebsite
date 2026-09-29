import { CSSProperties } from "react";
import { Img, staticFile } from "remotion";

// Screenshots are 1206x2622; frame keeps that aspect ratio.
export const PhoneFrame: React.FC<{
  src: string;
  width: number;
  style?: CSSProperties;
}> = ({ src, width, style }) => {
  const border = width * 0.03;
  return (
    <div
      style={{
        width,
        borderRadius: width * 0.14,
        border: `${border}px solid #0b0b0f`,
        boxShadow: "0 40px 90px rgba(0,0,0,0.45)",
        overflow: "hidden",
        background: "#0b0b0f",
        ...style,
      }}
    >
      <Img src={staticFile(src)} style={{ width: "100%", display: "block" }} />
    </div>
  );
};
