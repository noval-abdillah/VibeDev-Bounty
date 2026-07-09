import React from "react";

export function IconScale({ className = "w-5 h-5" }: { className?: string }) {
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
      <path d="M10 2v14M5 16h10" />
      {/* Left scale */}
      <path d="M10 5L5 7v1a2 2 0 004 0v-1" />
      {/* Right scale */}
      <path d="M10 5l5 2v1a2 2 0 00-4 0v-1" />
    </svg>
  );
}
