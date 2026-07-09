import React from "react";

export function IconFlask({ className = "w-5 h-5" }: { className?: string }) {
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
      <path d="M9 2v5.5a3 3 0 01-.757 2L5.5 13.243A3 3 0 006.5 18h7a3 3 0 001-4.757L11.757 9.5A3 3 0 0111 7.5V2" />
      <path d="M7 2h6" />
      <path d="M6.5 14h7" />
    </svg>
  );
}
