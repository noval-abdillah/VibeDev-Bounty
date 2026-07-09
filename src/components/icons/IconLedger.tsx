import React from "react";

export function IconLedger({ className = "w-5 h-5" }: { className?: string }) {
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
      <rect x="3" y="2" width="14" height="16" rx="2" />
      <path d="M7 6h6" />
      <path d="M7 10h6" />
      <path d="M7 14h4" />
    </svg>
  );
}
