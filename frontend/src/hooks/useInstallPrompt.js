import { useEffect, useState } from "react";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

/**
 * Menangkap event `beforeinstallprompt` (Android/desktop Chrome) supaya kita
 * bisa menampilkan tombol install kita sendiri, bukan banner bawaan browser.
 * iOS Safari tidak mengirim event ini sama sekali, jadi kita deteksi terpisah
 * dan tampilkan petunjuk manual ("Bagikan > Tambah ke Layar Utama").
 */
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(isStandalone());
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem("pwa_install_dismissed") === "1");

  useEffect(() => {
    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const canPromptNative = !!deferredPrompt;
  const showIosHint = isIos() && !installed;
  const shouldShow = !installed && !dismissed && (canPromptNative || showIosHint);

  async function promptInstall() {
    if (!deferredPrompt) return "unavailable";
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return outcome;
  }

  function dismiss() {
    setDismissed(true);
    sessionStorage.setItem("pwa_install_dismissed", "1");
  }

  return { shouldShow, canPromptNative, showIosHint, promptInstall, dismiss, installed };
}
