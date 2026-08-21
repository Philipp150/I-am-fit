"use client";

import { POSES, type JointAngles } from "@/lib/poses";
import type { PoseId } from "@/lib/types";

type Props = {
  pose: PoseId | JointAngles;
  className?: string;
  accent?: string;
};

export function StickFigure({ pose, className, accent = "#D97657" }: Props) {
  const angles = typeof pose === "string" ? POSES[pose] : pose;

  return (
    <svg viewBox="0 0 200 280" className={className} aria-hidden="true">
      <line x1="42" y1="248" x2="158" y2="248" stroke="#E7D7C1" strokeWidth="8" strokeLinecap="round" />
      <g
        transform={`translate(${angles.hipX} ${angles.hipY}) rotate(${angles.bodyTilt})`}
        stroke="#1F3F37"
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
      >
        <Limb thigh={angles.leftThigh} shin={angles.leftShin} />
        <Limb thigh={angles.rightThigh} shin={angles.rightShin} />
        <g transform={`rotate(${angles.torso})`}>
          <line x1="0" y1="0" x2="0" y2="-62" />
          <g transform="translate(0 -62)">
            <Arm upper={angles.leftUpperArm} fore={angles.leftForearm} hand={angles.leftHand} />
            <Arm upper={angles.rightUpperArm} fore={angles.rightForearm} hand={angles.rightHand} />
            <g transform={`rotate(${angles.neck}) translate(0 -22)`}>
              <circle r="17" fill="#FFFBF4" stroke="#1F3F37" strokeWidth="7" />
              <circle cx="-5" cy="-1" r="1.6" fill="#1F3F37" />
              <circle cx="5" cy="-1" r="1.6" fill="#1F3F37" />
              {angles.jaw > 0 ? (
                <path d={`M -5 7 Q 0 ${9 + angles.jaw} 5 7`} stroke="#1F3F37" strokeWidth="3" fill="none" />
              ) : (
                <circle cx="8" cy="4" r="2.2" fill={accent} />
              )}
            </g>
          </g>
        </g>
        <circle r="4.5" fill="#1F3F37" />
      </g>
    </svg>
  );
}

function Limb({ thigh, shin }: { thigh: number; shin: number }) {
  return (
    <g transform={`rotate(${thigh})`}>
      <line x1="0" y1="0" x2="0" y2="50" />
      <g transform={`translate(0 50) rotate(${shin})`}>
        <line x1="0" y1="0" x2="0" y2="48" />
      </g>
    </g>
  );
}

function Arm({ upper, fore, hand }: { upper: number; fore: number; hand: number }) {
  return (
    <g transform={`rotate(${upper})`}>
      <line x1="0" y1="0" x2="0" y2="38" />
      <g transform={`translate(0 38) rotate(${fore})`}>
        <line x1="0" y1="0" x2="0" y2="34" />
        <g transform={`translate(0 34) rotate(${hand})`}>
          <line x1="0" y1="0" x2="0" y2="12" strokeWidth="6" />
        </g>
      </g>
    </g>
  );
}
