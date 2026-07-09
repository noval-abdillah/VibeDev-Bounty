import React from "react";

export function IconTruck({ className = "w-5 h-5" }: { className?: string }) {
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
      <rect x="2" y="4" width="10" height="10" rx="1" />
      <path d="M12 7h4l2 2v5h-6V7z" />
      <circle cx="5.5" cy="14" r="1.5" />
      <circle cx="14.5" cy="14" r="1.5" />
    </svg>
  );
}
