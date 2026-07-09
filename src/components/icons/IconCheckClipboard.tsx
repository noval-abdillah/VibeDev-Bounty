import React from "react";

export function IconCheckClipboard({ className = "w-5 h-5" }: { className?: string }) {
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
      <rect x="5" y="4" width="10" height="14" rx="2" />
      <path d="M7 2a1 1 0 011-1h4a1 1 0 011 1v2H7V2z" />
      <path d="M8 10l1.5 1.5 3-3" />
    </svg>
  );
}
