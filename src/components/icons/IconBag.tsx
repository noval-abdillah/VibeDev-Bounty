import React from "react";

export function IconBag({ className = "w-5 h-5" }: { className?: string }) {
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
      <rect x="3" y="6" width="14" height="12" rx="2" />
      <path d="M6 6c0-2.2 1.8-4 4-4s4 1.8 4 4" />
    </svg>
  );
}
