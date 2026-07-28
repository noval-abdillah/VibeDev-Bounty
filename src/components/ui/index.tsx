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
    <section
      className={twMerge(
        "p-5 md:p-6 bg-white border border-border/80 rounded-md shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-300 ease-in-out",
        className
      )}
      {...props}
    >
      {(title || action) && (
        <div className="flex flex-wrap justify-between items-center gap-3 mb-5 pb-4 border-b border-border/60">
          {title && <h2 className="font-heading text-sm md:text-base font-bold text-ink tracking-wide">{title}</h2>}
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
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
        "px-4 py-2.5 min-h-[44px] min-w-[44px] text-xs font-semibold rounded-sm tracking-wide transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] active:duration-75 inline-flex items-center justify-center gap-1.5 shadow-sm hover:shadow-md",
        variant === "primary" && "bg-primary hover:bg-primary-dark text-white hover:-translate-y-[1px]",
        variant === "ghost" && "border border-border bg-white text-ink-soft hover:bg-bg hover:text-ink hover:border-primary/30",
        variant === "danger" && "bg-danger hover:bg-danger/90 text-white hover:-translate-y-[1px]",
        variant === "success" && "bg-success hover:bg-success/90 text-white hover:-translate-y-[1px]",
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
  className?: string;
}

export function Tag({ variant = "neutral", children, className }: TagProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase font-mono shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]",
        variant === "success" && "bg-success-bg text-success border border-success/20",
        variant === "warning" && "bg-warning-bg text-warning border border-warning/20",
        variant === "danger" && "bg-danger-bg text-danger border border-danger/20",
        variant === "primary" && "bg-primary-light text-ink border border-primary/20",
        variant === "neutral" && "bg-primary-light text-ink-soft border border-border",
        className
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
  const inputId = id || `input-${label?.toLowerCase().replace(/\s+/g, "-")}`;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={inputId} className="text-xs font-semibold text-ink-soft/90">
          {label}
        </label>
      )}
      <input
        id={inputId}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={errorId}
        className={twMerge(
          "w-full px-3 py-3 min-h-[44px] text-sm bg-white border border-border rounded-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono transition-all duration-250 shadow-sm",
          error && "border-danger focus:border-danger focus:ring-danger/10",
          className
        )}
        {...props}
      />
      {error && (
        <span id={errorId} role="alert" className="text-[10px] text-danger font-semibold mt-0.5">
          {error}
        </span>
      )}
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
  const selectId = id || `select-${label?.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={selectId} className="text-xs font-semibold text-ink-soft/90">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={twMerge(
          "w-full px-3 py-3 min-h-[44px] text-sm bg-white border border-border rounded-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-250 shadow-sm",
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

// SCROLL TABLE WRAPPER
interface ScrollTableProps {
  children: React.ReactNode;
  className?: string;
}

export function ScrollTable({ children, className }: ScrollTableProps) {
  return (
    <div className={twMerge("relative overflow-x-auto rounded-md border border-border/80 shadow-sm bg-white", className)} role="region" aria-label="Tabel dengan scroll horizontal">
      {children}
      <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white pointer-events-none sm:hidden" aria-hidden="true" />
    </div>
  );
}

// ALERT / NOTIFICATION BANNER
interface AlertProps {
  variant?: "success" | "warning" | "danger";
  children: React.ReactNode;
}

export function Alert({ variant = "warning", children }: AlertProps) {
  return (
    <div
      role="alert"
      className={clsx(
        "rounded-md p-4 text-xs font-semibold flex items-center gap-3 shadow-sm border transition-all duration-300",
        variant === "warning" && "bg-warning-bg border-warning/20 text-warning",
        variant === "danger" && "bg-danger-bg border-danger/20 text-danger animate-pulse-slow",
        variant === "success" && "bg-success-bg border-success/20 text-success"
      )}
    >
      {children}
    </div>
  );
}

// LOADING SPINNER / SKELETON
export function Loading({ text = "Memuat..." }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3" role="status" aria-live="polite">
      <div className="relative w-10 h-10">
        <span className="absolute inset-0 rounded-full border-4 border-primary/20"></span>
        <span className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></span>
      </div>
      <span className="text-ink-soft font-mono text-xs tracking-wider animate-pulse">{text}</span>
    </div>
  );
}
