import { Calendar, LayoutGrid, MapPin, Clock, ChevronLeft, ChevronRight, ChevronDown, Menu, X, Grid2x2, Download } from "lucide-react";

export const Ic = { Calendar, LayoutGrid, MapPin, Clock, ChevronLeft, ChevronRight, ChevronDown, Menu, X, Grid2x2, Download };

export function FactIcon({ name, size = 16 }: { name: string; size?: number }) {
  if (name === "calendar") return <Calendar size={size} />;
  if (name === "grid") return <LayoutGrid size={size} />;
  if (name === "clock") return <Clock size={size} />;
  return <MapPin size={size} />;
}

/** The pickleball court outline used on the splash screen. */
export function CourtOutline({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 140 300" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="2">
      <rect x="1" y="1" width="138" height="298" />
      <line x1="1" y1="150" x2="139" y2="150" stroke="rgba(255,255,255,.9)" strokeWidth="3" />
      <line x1="1" y1="105" x2="139" y2="105" />
      <line x1="1" y1="195" x2="139" y2="195" />
      <line x1="70" y1="1" x2="70" y2="105" />
      <line x1="70" y1="195" x2="70" y2="299" />
    </svg>
  );
}
