"use client";

import { POSES, type JointAngles } from "@/lib/poses";
import type { PoseId } from "@/lib/types";

const HIP_W = 11;
const SHOULDER_W = 22;
const TORSO = 68;
const THIGH = 50;
const SHIN = 46;
const FOOT = 16;
const UPPER = 36;
const FORE = 32;
const HAND = 13;
const NECK = 16;

type Props = {
  pose: PoseId | JointAngles;
  className?: string;
  accent?: string;
};

export function StickFigure({ pose, className, accent = "#D97657" }: Props) {
  const angles = typeof pose === "string" ? POSES[pose] ?? POSES.stand : pose;
  const jaw = angles.jaw ?? 0;

  return (
    <svg viewBox="0 0 200 280" className={className} aria-hidden="true">
      <ellipse cx="100" cy="248" rx="52" ry="7" fill="#E7D7C1" opacity="0.85" />
      <g transform={`translate(${angles.hipX} ${angles.hipY}) rotate(${angles.bodyTilt})`}>
        <Leg side={-1} thigh={angles.leftThigh} shin={angles.leftShin} accent={accent} />
        <Leg side={1} thigh={angles.rightThigh} shin={angles.rightShin} accent={accent} />

        <g transform={`rotate(${angles.torso})`}>
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

          <Arm
            side={-1}
            upper={angles.leftUpperArm}
            fore={angles.leftForearm}
            hand={angles.leftHand ?? 0}
            accent={accent}
          />
          <Arm
            side={1}
            upper={angles.rightUpperArm}
            fore={angles.rightForearm}
            hand={angles.rightHand ?? 0}
            accent={accent}
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
            <g transform={`translate(0 ${-NECK - 18})`}>
              <ellipse rx="15" ry="18.5" fill="#FFFBF4" stroke="#1F3F37" strokeWidth="3.2" />
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
}: {
  side: -1 | 1;
  upper: number;
  fore: number;
  hand: number;
  accent: string;
}) {
  return (
    <g transform={`translate(${side * SHOULDER_W} ${-TORSO}) rotate(${upper})`}>
      <Joint r={5.8} accent={accent} />
      <Bone length={UPPER} weight={9.5} />
      <g transform={`translate(0 ${UPPER}) rotate(${fore})`}>
        <Joint r={5.2} accent={accent} />
        <Bone length={FORE} weight={8.5} />
        <g transform={`translate(0 ${FORE}) rotate(${hand})`}>
          <Joint r={4.4} accent={accent} />
          <line x1="0" y1="0" x2="0" y2={HAND} stroke="#1F3F37" strokeWidth="7" strokeLinecap="round" />
        </g>
      </g>
    </g>
  );
}
