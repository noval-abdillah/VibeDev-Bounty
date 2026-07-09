import React from "react";

export function IconBoxes({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="11" width="6" height="6" rx="1" />
      <rect x="11" y="11" width="6" height="6" rx="1" />
      <rect x="7" y="3" width="6" height="6" rx="1" />
      <path d="M10 9v2M6 11V9.5a1.5 1.5 0 011.5-1.5h5A1.5 1.5 0 0114 9.5V11" />
    </svg>
  );
}
