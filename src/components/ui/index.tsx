import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// SECTION CARD
interface SectionCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  action?: React.ReactNode;
}

export function SectionCard({ className, title, action, children, ...props }: SectionCardProps) {
  return (
    <div
      className={twMerge("p-4 md:p-[18px] bg-white border border-border rounded-md", className)}
      {...props}
    >
      {(title || action) && (
        <div className="flex flex-wrap justify-between items-start gap-2 mb-4 pb-3 border-b border-border">
          {title && <h2 className="font-heading text-[14.5px] font-semibold text-ink">{title}</h2>}
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

// BUTTON — Touch target min 44px per WCAG
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "danger" | "success";
}

export function Button({ className, variant = "primary", children, ...props }: ButtonProps) {
  return (
    <button
      className={twMerge(
        "px-4 py-2.5 min-h-[44px] text-xs font-semibold rounded-sm transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95",
        variant === "primary" && "bg-primary hover:bg-primary-dark text-white",
        variant === "ghost" && "border border-border bg-white text-ink-soft hover:bg-bg hover:text-ink",
        variant === "danger" && "bg-danger hover:bg-danger/90 text-white",
        variant === "success" && "bg-success hover:bg-success/90 text-white",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// TAG / BADGE
interface TagProps {
  variant?: "success" | "warning" | "danger" | "primary" | "neutral";
  children: React.ReactNode;
}

export function Tag({ variant = "neutral", children }: TagProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide font-mono",
        variant === "success" && "bg-success-bg text-success",
        variant === "warning" && "bg-warning-bg text-warning",
        variant === "danger" && "bg-danger-bg text-danger",
        variant === "primary" && "bg-primary-light text-ink",
        variant === "neutral" && "bg-primary-light text-ink-soft"
      )}
    >
      {children}
    </span>
  );
}

// INPUT — Touch target min 44px
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, id, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1 w-full">
      {label && (
        <label htmlFor={id} className="text-xs font-semibold text-ink-soft">
          {label}
        </label>
      )}
      <input
        id={id}
        className={twMerge(
          "w-full px-3 py-3 min-h-[44px] text-sm bg-white border border-border rounded-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary font-mono transition-colors",
          error && "border-danger focus:border-danger focus:ring-danger/20",
          className
        )}
        {...props}
      />
      {error && <span className="text-[10px] text-danger font-semibold mt-0.5">{error}</span>}
    </div>
  );
}

// SELECT — Touch target min 44px
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, error, options, className, id, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1 w-full">
      {label && (
        <label htmlFor={id} className="text-xs font-semibold text-ink-soft">
          {label}
        </label>
      )}
      <select
        id={id}
        className={twMerge(
          "w-full px-3 py-3 min-h-[44px] text-sm bg-white border border-border rounded-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors",
          className
        )}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span className="text-[10px] text-danger font-semibold mt-0.5">{error}</span>}
    </div>
  );
}

// SCROLL TABLE WRAPPER — Adds horizontal scroll with visual indicator for mobile
interface ScrollTableProps {
  children: React.ReactNode;
  className?: string;
}

export function ScrollTable({ children, className }: ScrollTableProps) {
  return (
    <div className={twMerge("relative overflow-x-auto rounded-sm", className)}>
      {children}
      <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white pointer-events-none sm:hidden" />
    </div>
  );
}
