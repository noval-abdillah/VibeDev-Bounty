import React from "react";

export function IconVial({ className = "w-5 h-5" }: { className?: string }) {
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
      <path d="M7 2h6" />
      <path d="M8 2v10a2 2 0 004 0V2" />
      <path d="M8 6h4" />
      <path d="M8 9h4" />
    </svg>
  );
}
