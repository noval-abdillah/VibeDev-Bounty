import React from "react";

export function IconBell({ className = "w-5 h-5" }: { className?: string }) {
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
      <path d="M10 2a4 4 0 00-4 4v4H4.5a1.5 1.5 0 000 3h11a1.5 1.5 0 000-3H14V6a4 4 0 00-4-4z" />
      <path d="M8 15v.5a2 2 0 004 0V15" />
    </svg>
  );
}
