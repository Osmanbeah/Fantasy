import React from 'react';

export function getInitials(name) {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function getStringColor(str) {
  if (!str) return 'hsl(200, 60%, 40%)';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  // Use a premium dark-mode friendly HSL palette
  // Saturation 65%, Lightness 45% for bright but readable text on dark background
  return `hsl(${h}, 65%, 45%)`;
}

export default function PlayerAvatar({ name, className = "w-10 h-10 text-sm font-semibold" }) {
  const initials = getInitials(name);
  const bgColor = getStringColor(name);

  return (
    <div
      className={`rounded-full flex items-center justify-center text-white select-none ${className}`}
      style={{ backgroundColor: bgColor }}
    >
      {initials}
    </div>
  );
}
