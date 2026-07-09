import React from "react";

export function IconEdit({ className = "w-5 h-5" }: { className?: string }) {
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
      <path d="M13.5 2.5a2.121 2.121 0 113 3L6.5 15.5H3.5v-3L13.5 2.5z" />
    </svg>
  );
}
