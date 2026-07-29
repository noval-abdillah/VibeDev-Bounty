"use client";

import React from "react";
import { useToast, Toast } from "@/context/ToastContext";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";

export function ToastContainer() {
  const { toasts, dismissToast } = useToast();

  const getIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle2 className="w-5 h-5 text-success shrink-0" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-warning shrink-0" />;
      case "danger":
        return <XCircle className="w-5 h-5 text-danger shrink-0" />;
      default:
        return <Info className="w-5 h-5 text-primary shrink-0" />;
    }
  };

  const getBgColor = (type: string) => {
    switch (type) {
      case "success":
        return "bg-success-bg border-success/30";
      case "warning":
        return "bg-warning-bg border-warning/30";
      case "danger":
        return "bg-danger-bg border-danger/30";
      default:
        return "bg-white border-border/80";
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 w-full max-w-sm pointer-events-none px-4 sm:px-0">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-md border shadow-lg ${getBgColor(
              toast.type
            )}`}
          >
            {getIcon(toast.type)}
            <div className="flex-1 text-xs font-semibold text-ink leading-relaxed">
              {toast.message}
            </div>
            <button
              onClick={() => dismissToast(toast.id)}
              className="text-ink-soft/75 hover:text-ink transition-colors p-0.5 rounded-full hover:bg-black/5 shrink-0"
              aria-label="Tutup notifikasi"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
