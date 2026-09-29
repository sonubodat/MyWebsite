import { Composition, Still } from "remotion";
import { AiProofPoster } from "./AiProof/AiProofPoster";
import { AI_PROOF_DURATION, AiProofVideo } from "./AiProof/AiProofVideo";
import {
  COMP_NAME,
  defaultMyCompProps,
  DURATION_IN_FRAMES,
  VIDEO_FPS,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
} from "../../types/constants";
import { Main } from "./MyComp/Main";
import { NextLogo } from "./MyComp/NextLogo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id={COMP_NAME}
        component={Main}
        durationInFrames={DURATION_IN_FRAMES}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        defaultProps={defaultMyCompProps}
      />
      <Composition
        id="AiProofVideo"
        component={AiProofVideo}
        durationInFrames={AI_PROOF_DURATION}
        fps={30}
        width={1080}
        height={1920}
      />
      <Still
        id="AiProofPoster"
        component={AiProofPoster}
        width={1920}
        height={1080}
      />
      <Composition
        id="NextLogo"
        component={NextLogo}
        durationInFrames={300}
        fps={30}
        width={140}
        height={140}
        defaultProps={{
          outProgress: 0,
        }}
      />
    </>
  );
};
