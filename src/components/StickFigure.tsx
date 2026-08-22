"use client";

import { FIGURE, viewBoxAttr } from "@/lib/pose-geometry";
import { POSES, type JointAngles } from "@/lib/poses";
import type { PoseId } from "@/lib/types";

// One source of truth for the skeleton, shared with `pose-geometry.ts` so the tests measure the
// same figure that gets drawn.
const HIP_W = FIGURE.hipW;
const SHOULDER_W = FIGURE.shoulderW;
const TORSO = FIGURE.torso;
const THIGH = FIGURE.thigh;
const SHIN = FIGURE.shin;
const FOOT = FIGURE.foot;
const UPPER = FIGURE.upper;
const FORE = FIGURE.fore;
const HAND = FIGURE.hand;
const NECK = FIGURE.neck;

type Props = {
  pose: PoseId | JointAngles;
  className?: string;
  accent?: string;
};

export function StickFigure({ pose, className, accent = "#D97657" }: Props) {
  const angles = typeof pose === "string" ? POSES[pose] ?? POSES.stand : pose;
  const jaw = angles.jaw ?? 0;
  const shoulderLift = angles.shoulderLift ?? 0;
  const headShiftX = angles.headShiftX ?? 0;
  const headShiftY = angles.headShiftY ?? 0;
  const chest = angles.chest ?? 0;
  const chestScale = 1 + chest * 0.012;
  const shoulderY = -TORSO - shoulderLift;

  return (
    <svg viewBox={viewBoxAttr()} className={className} aria-hidden="true">
      <ellipse cx="100" cy="250" rx="58" ry="7" fill="#E7D7C1" opacity="0.85" />
      <g transform={`translate(${angles.hipX} ${angles.hipY}) rotate(${angles.bodyTilt})`}>
        <Leg side={-1} thigh={angles.leftThigh} shin={angles.leftShin} accent={accent} />
        <Leg side={1} thigh={angles.rightThigh} shin={angles.rightShin} accent={accent} />

        <g transform={`rotate(${angles.torso}) scale(${chestScale} 1)`}>
          <path
            d={`M ${-HIP_W - 2} 6
                C ${-HIP_W - 6} -18, ${-SHOULDER_W - 2} -${TORSO - 18}, ${-SHOULDER_W} -${TORSO}
                C ${-10} -${TORSO + 6}, 10 -${TORSO + 6}, ${SHOULDER_W} -${TORSO}
                C ${SHOULDER_W + 2} -${TORSO - 18}, ${HIP_W + 6} -18, ${HIP_W + 2} 6
                Z`}
            fill="#F4EFE6"
            stroke="#1F3F37"
            strokeWidth="3.2"
            strokeLinejoin="round"
          />
          <ellipse cx="0" cy="2" rx="16" ry="9" fill="#FFFBF4" stroke="#1F3F37" strokeWidth="3" />
          <Joint r={6.5} accent={accent} />

          <line
            x1={-6}
            y1={-TORSO + 6}
            x2={-SHOULDER_W}
            y2={shoulderY}
            stroke="#1F3F37"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <line
            x1={6}
            y1={-TORSO + 6}
            x2={SHOULDER_W}
            y2={shoulderY}
            stroke="#1F3F37"
            strokeWidth="7"
            strokeLinecap="round"
          />

          <Arm
            side={-1}
            upper={angles.leftUpperArm}
            fore={angles.leftForearm}
            hand={angles.leftHand ?? 0}
            accent={accent}
            shoulderY={shoulderY}
          />
          <Arm
            side={1}
            upper={angles.rightUpperArm}
            fore={angles.rightForearm}
            hand={angles.rightHand ?? 0}
            accent={accent}
            shoulderY={shoulderY}
          />

          <g transform={`translate(0 ${-TORSO}) rotate(${angles.neck})`}>
            <line
              x1="0"
              y1="0"
              x2="0"
              y2={-NECK}
              stroke="#1F3F37"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <Joint r={4.5} accent={accent} />
            <g transform={`translate(${headShiftX} ${-NECK - FIGURE.headGap + headShiftY})`}>
              <ellipse rx={FIGURE.headRx} ry={FIGURE.headRy} fill="#FFFBF4" stroke="#1F3F37" strokeWidth="3.2" />
              <ellipse cx="-5.5" cy="-2" rx="1.7" ry="2.2" fill="#1F3F37" />
              <ellipse cx="5.5" cy="-2" rx="1.7" ry="2.2" fill="#1F3F37" />
              {jaw > 0 ? (
                <path
                  d={`M -5 8 Q 0 ${10 + jaw} 5 8`}
                  stroke="#1F3F37"
                  strokeWidth="2.4"
                  fill="none"
                  strokeLinecap="round"
                />
              ) : (
                <path d="M -4 8 Q 0 11 4 8" stroke="#1F3F37" strokeWidth="2" fill="none" strokeLinecap="round" />
              )}
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}

function Joint({ r, accent }: { r: number; accent: string }) {
  return (
    <>
      <circle r={r} fill="#FFFBF4" stroke="#1F3F37" strokeWidth="2.2" />
      <circle r={Math.max(1.6, r * 0.38)} fill={accent} />
    </>
  );
}

function Bone({ length, weight }: { length: number; weight: number }) {
  return (
    <line
      x1="0"
      y1="0"
      x2="0"
      y2={length}
      stroke="#1F3F37"
      strokeWidth={weight}
      strokeLinecap="round"
    />
  );
}

function Leg({
  side,
  thigh,
  shin,
  accent,
}: {
  side: -1 | 1;
  thigh: number;
  shin: number;
  accent: string;
}) {
  return (
    <g transform={`translate(${side * HIP_W} 6) rotate(${thigh})`}>
      <Bone length={THIGH} weight={11} />
      <g transform={`translate(0 ${THIGH}) rotate(${shin})`}>
        <Joint r={5.6} accent={accent} />
        <Bone length={SHIN} weight={10} />
        <g transform={`translate(0 ${SHIN})`}>
          <Joint r={5} accent={accent} />
          <line
            x1="0"
            y1="0"
            x2={side * 3}
            y2={FOOT}
            stroke="#1F3F37"
            strokeWidth="8"
            strokeLinecap="round"
          />
        </g>
      </g>
    </g>
  );
}

function Arm({
  side,
  upper,
  fore,
  hand,
  accent,
  shoulderY,
}: {
  side: -1 | 1;
  upper: number;
  fore: number;
  hand: number;
  accent: string;
  shoulderY: number;
}) {
  return (
    <g transform={`translate(${side * SHOULDER_W} ${shoulderY}) rotate(${upper})`}>
      <Joint r={5.8} accent={accent} />
      <Bone length={UPPER} weight={9.5} />
      <g transform={`translate(0 ${UPPER}) rotate(${fore})`}>
        <Joint r={5.2} accent={accent} />
        <Bone length={FORE} weight={8.5} />
        <g transform={`translate(0 ${FORE}) rotate(${hand})`}>
          <Joint r={4.4} accent={accent} />
          <line x1="0" y1="0" x2="0" y2={HAND} stroke="#1F3F37" strokeWidth="7.2" strokeLinecap="round" />
          <line
            x1="0"
            y1="2"
            x2={side * 7}
            y2={HAND - 3}
            stroke="#1F3F37"
            strokeWidth="4.6"
            strokeLinecap="round"
          />
        </g>
      </g>
    </g>
  );
}
