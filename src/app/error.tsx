"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-8">
      <div className="max-w-md text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-danger-bg flex items-center justify-center">
          <span className="text-2xl text-danger font-bold">!</span>
        </div>
        <h1 className="font-heading text-xl font-bold text-ink mb-2">Terjadi Kesalahan</h1>
        <p className="text-ink-soft text-sm mb-2 leading-relaxed">
          {error.message || "Halaman tidak dapat dimuat. Silakan coba lagi."}
        </p>
        <p className="text-ink-faint text-xs mb-6">
          Jika masalah berlanjut, pastikan environment variables Supabase sudah di-set dengan benar.
        </p>
        <button
          onClick={() => reset()}
          className="px-6 py-3 bg-primary text-white font-semibold text-sm rounded-sm hover:bg-primary-dark transition-colors"
        >
          Coba Lagi
        </button>
      </div>
    </div>
  );
}
