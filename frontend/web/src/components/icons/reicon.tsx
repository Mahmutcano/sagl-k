"use client";

import type { IconComponent } from "reicon-react/createIcon";
import ArrowRight from "reicon-react/icons/ArrowRight";
import Building from "reicon-react/icons/Building";
import Card from "reicon-react/icons/Card";
import ChatRound from "reicon-react/icons/ChatRound";
import ClipboardCheck from "reicon-react/icons/ClipboardCheck";
import DocumentText2 from "reicon-react/icons/DocumentText2";
import Health from "reicon-react/icons/Health";
import Hospital from "reicon-react/icons/Hospital";
import ProfileAdd2 from "reicon-react/icons/ProfileAdd2";
import ShieldCheck from "reicon-react/icons/ShieldCheck";

export type { IconComponent };

export {
  ArrowRight,
  Building,
  Card,
  ChatRound,
  ClipboardCheck,
  DocumentText2,
  Health,
  Hospital,
  ProfileAdd2,
  ShieldCheck,
};

export function ReiconIcon({
  icon: Icon,
  size = 20,
  className,
}: {
  icon: IconComponent;
  size?: number;
  className?: string;
}) {
  return (
    <span className={className} style={{ display: "inline-flex", lineHeight: 0 }}>
      <Icon size={size} weight="Outline" color="currentColor" />
    </span>
  );
}
