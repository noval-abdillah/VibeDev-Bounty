"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { Topbar } from "./Topbar";
import { AnimatePresence, motion } from "framer-motion";

const Sidebar = dynamic(() => import("./Sidebar").then(mod => ({ default: mod.Sidebar })), {
  ssr: false,
  loading: () => <div className="w-[248px] bg-sidebar h-full shrink-0" />,
});

export function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router, mounted]);

  if (!mounted || loading || !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg gap-3">
        <div className="relative w-12 h-12">
          <span className="absolute inset-0 rounded-full border-4 border-primary/20"></span>
          <span className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></span>
        </div>
        <div className="text-ink-soft font-mono text-xs tracking-wider animate-pulse">Memproses Autentikasi...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg relative">
      {/* Backdrop for mobile */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-40 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar drawer */}
      <div className="hidden lg:block h-full">
        <Sidebar />
      </div>

      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 left-0 z-50 lg:hidden"
          >
            <Sidebar onClose={() => setIsSidebarOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Topbar onMenuClick={() => setIsSidebarOpen(true)} />
        <motion.main 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto min-h-0" 
          role="main" 
          id="main-content"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}
