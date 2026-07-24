import { useRef, useState } from "react";

// ============================================
// SecretTapGate
// ------------------------------------------------
// Menampilkan layar netral (tidak ada petunjuk apa pun) sampai target di
// dalamnya di-tap sejumlah `requiredTaps` kali dalam rentang `windowMs`.
// Setelah syarat itu terpenuhi, `children` (biasanya form login) baru dirender.
//
// PENTING: ini HANYA gestur untuk "memunculkan form login" di UI, BUKAN metode
// autentikasi. Setelah muncul, form login tetap meminta token/secret key yang
// diverifikasi oleh backend seperti biasa — jadi tetap tercatat & bisa diaudit.
// ============================================
export default function SecretTapGate({ requiredTaps = 5, windowMs = 3000, children }) {
  const [unlocked, setUnlocked] = useState(false);
  const [count, setCount] = useState(0);
  const timerRef = useRef(null);

  function handleTap() {
    setCount((prev) => {
      const next = prev + 1;

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCount(0), windowMs);

      if (next >= requiredTaps) {
        setUnlocked(true);
        return 0;
      }
      return next;
    });
  }

  if (unlocked) return children;

  return (
    <div
      onClick={handleTap}
      className="flex min-h-screen select-none items-center justify-center bg-white text-ink"
      // Sengaja tanpa teks/label apa pun yang menyiratkan area ini bisa di-tap.
    >
      <div className="h-16 w-16 rounded-full bg-ink/5" aria-hidden="true" />
    </div>
  );
}
