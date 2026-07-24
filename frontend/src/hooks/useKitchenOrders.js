import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";

// CATATAN: sebelumnya hook ini pakai SSE (EventSource) lewat Durable Object
// untuk dua hal: (1) tahu ada order baru masuk secara realtime, dan (2)
// dengarkan perubahan URL suara notifikasi kustom dari admin. Karena
// dashboard Kitchen biasanya dibiarkan terbuka TERUS-MENERUS di layar dapur,
// ini adalah sumber pemakaian jatah Durable Object paling besar dan paling
// sering bikin kena limit "Exceeded allowed duration in Durable Objects free
// tier" (503 terus-menerus sampai reset jam 00:00 UTC).
//
// Sekarang diganti total ke polling biasa (fetch tiap beberapa detik) —
// tidak menyentuh Durable Object sama sekali. Order baru akan terdeteksi
// paling lambat satu siklus polling kemudian (beberapa detik), yang untuk
// kebutuhan dapur tetap terasa real-time.
const ORDERS_POLL_INTERVAL_MS = 4000;
const SETTINGS_POLL_INTERVAL_MS = 15000;

export function useKitchenOrders(token) {
  const [orders, setOrders] = useState([]);
  const [connected, setConnected] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem("kitchen_sound_enabled") !== "0");
  // Mencerminkan status AudioContext yang SEBENARNYA (bukan cuma "soundEnabled" dari toggle lonceng).
  // false berarti AudioContext belum pernah dibuat / masih suspended -> notifikasi tidak akan bunyi
  // walau lonceng terlihat ON. Dipakai untuk menampilkan banner peringatan di UI.
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const audioCtxRef = useRef(null);

  // URL mp3 suara notifikasi kustom yang diupload admin (kosong = pakai beep + voice default).
  const customSoundUrlRef = useRef("");
  const customAudioElRef = useRef(null);
  // Elemen <audio> TERPISAH khusus untuk "memanaskan" izin autoplay browser (dipakai di
  // unlockAudio). SEBELUMNYA elemen ini sama dengan customAudioElRef -- itu menyebabkan race
  // condition: unlockAudio() set volume=0 lalu balikin volume via .finally() yang ASYNC, dan
  // finally itu bisa jalan SETELAH playCustomSound() sudah men-set volume=1 & mulai memutar
  // suara asli -- hasilnya suara notifikasi kepakai tapi volume ke-timpa balik ke 0 (play()
  // sukses tapi senyap). Dengan elemen terpisah, priming tidak lagi bisa menimpa playback asli.
  const primerAudioElRef = useRef(null);

  // Dipakai untuk mendeteksi order baru dibandingkan hasil polling sebelumnya.
  const knownOrderIdsRef = useRef(null);

  const loadOrders = useCallback(async () => {
    try {
      const data = await api.getOrders(token);
      const list = data.orders || [];

      // Deteksi order baru: bandingkan id order hasil fetch ini dengan yang sudah
      // pernah kita lihat. Lewati deteksi di fetch PERTAMA supaya order lama yang
      // sudah ada tidak dianggap "baru" dan memicu bunyi saat dashboard baru dibuka.
      if (knownOrderIdsRef.current) {
        const isNew = list.some((o) => !knownOrderIdsRef.current.has(o.id));
        // [DEBUG SEMENTARA] hapus setelah selesai investigasi
        console.log("[kitchen-debug] loadOrders tick:", {
          jumlahOrder: list.length,
          idOrderSekarang: list.map((o) => o.id),
          idOrderSebelumnya: [...knownOrderIdsRef.current],
          isNew,
        });
        if (isNew) {
          // PENTING: dibungkus try/catch SENDIRI (terpisah dari try/catch fetch di atas).
          // Kalau pemutaran suara error, itu TIDAK BOLEH ikut menggagalkan setOrders/setConnected
          // di bawah -- sebelumnya satu try/catch dipakai bersama, jadi error di audio bisa bikin
          // seluruh update order & status koneksi ikut gagal diam-diam tiap ada order baru.
          try {
            playNewOrderAlertRef.current();
          } catch (err) {
            console.error("[kitchen-debug] ERROR saat memutar suara notifikasi:", err);
          }
        }
      } else {
        console.log("[kitchen-debug] fetch PERTAMA (baseline, tidak akan bunyi):", list.map((o) => o.id));
      }
      knownOrderIdsRef.current = new Set(list.map((o) => o.id));

      setOrders(list);
      setConnected(true);
      return true;
    } catch {
      setConnected(false);
      return false;
    }
  }, [token]);

  const unlockAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtxRef.current = new Ctx();
    }
    const ctx = audioCtxRef.current;
    if (ctx) {
      if (ctx.state === "suspended") {
        ctx
          .resume()
          .then(() => setAudioUnlocked(ctx.state === "running"))
          .catch(() => setAudioUnlocked(false));
      } else {
        setAudioUnlocked(ctx.state === "running");
      }
    }

    // "Panaskan" elemen <audio> dari dalam gesture user, supaya browser mobile mengizinkan
    // audio.play() otomatis nanti. Pakai elemen TERPISAH (bukan customAudioElRef) supaya tidak
    // menimpa volume/playback suara notifikasi kustom yang asli (lihat catatan di primerAudioElRef).
    if (!primerAudioElRef.current) {
      primerAudioElRef.current = new Audio();
    }
    const primeEl = primerAudioElRef.current;
    const prevVolume = primeEl.volume;
    primeEl.volume = 0;
    primeEl
      .play()
      .then(() => primeEl.pause())
      .catch(() => {})
      .finally(() => {
        primeEl.volume = prevVolume;
      });

    // "Panaskan" Web Speech API dari dalam gesture user (klik login), supaya nanti
    // saat order masuk secara realtime, browser mengizinkan suara perintah diputar otomatis.
    if (window.speechSynthesis) {
      try {
        const warm = new SpeechSynthesisUtterance(" ");
        warm.volume = 0;
        window.speechSynthesis.speak(warm);
      } catch {
        /* browser tidak dukung speech synthesis, abaikan */
      }
    }
  }, []);

  const playNotificationSound = useCallback(() => {
    if (!soundEnabled) return;
    unlockAudio();
    const ctx = audioCtxRef.current;
    // [DEBUG SEMENTARA] hapus setelah selesai investigasi
    console.log("[kitchen-debug] playNotificationSound. ctx ada?", !!ctx, "ctxState:", ctx?.state);
    if (!ctx) return;
    const playBeep = (freq, startTime, duration, peakGain = 0.55) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };
    const now = ctx.currentTime;
    // Nada nyaring 3x berturut-turut supaya benar-benar kedengaran di dapur yang ramai
    playBeep(1046, now, 0.16);
    playBeep(1318, now + 0.18, 0.16);
    playBeep(1568, now + 0.36, 0.28);
  }, [soundEnabled, unlockAudio]);

  // Suara perintah "Woe, ada order masuk nih!" lewat text-to-speech browser,
  // menyusul setelah bunyi beep supaya dapur langsung sadar ada pesanan baru.
  const playVoiceAlert = useCallback(() => {
    if (!soundEnabled) return;
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    try {
      const utter = new SpeechSynthesisUtterance("Woe, ada order masuk nih!");
      utter.lang = "id-ID";
      utter.rate = 1.05;
      utter.pitch = 1.15;
      utter.volume = 1;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    } catch {
      /* browser tidak dukung speech synthesis, abaikan */
    }
  }, [soundEnabled]);

  // Putar file mp3 kustom yang diupload admin (kalau ada).
  const playCustomSound = useCallback((url) => {
    if (!customAudioElRef.current) {
      customAudioElRef.current = new Audio();
      // [DEBUG SEMENTARA] tangkap kegagalan LOAD (404, format tidak didukung, network error, dll)
      // -- ini beda dari kegagalan play(), dan sebelumnya tidak pernah ter-log sama sekali.
      customAudioElRef.current.addEventListener("error", () => {
        const err = customAudioElRef.current?.error;
        console.error("[kitchen-debug] GAGAL LOAD file suara kustom.", {
          url: customAudioElRef.current?.src,
          errorCode: err?.code, // 1=ABORTED 2=NETWORK 3=DECODE 4=SRC_NOT_SUPPORTED
          errorMessage: err?.message,
        });
      });
    }
    const el = customAudioElRef.current;
    el.src = url;
    el.volume = 1;
    el.currentTime = 0;
    // [DEBUG SEMENTARA] log URL penuh + hasil play() apa adanya, jangan ditelan diam-diam
    console.log("[kitchen-debug] playCustomSound mencoba play():", url);
    el.play()
      .then(() => console.log("[kitchen-debug] playCustomSound BERHASIL play()"))
      .catch((err) => {
        console.error("[kitchen-debug] playCustomSound GAGAL play():", err?.name, err?.message);
      });
  }, []);

  // Dipanggil tiap ada order baru: pakai suara kustom kalau admin sudah upload,
  // kalau belum ada, jatuh balik ke beep + suara perintah default.
  const playNewOrderAlert = useCallback(() => {
    // [DEBUG SEMENTARA] hapus setelah selesai investigasi
    console.log("[kitchen-debug] playNewOrderAlert dipanggil. soundEnabled:", soundEnabled, "customUrl:", customSoundUrlRef.current, "ctxState:", audioCtxRef.current?.state);
    if (!soundEnabled) return;
    const customUrl = customSoundUrlRef.current;
    if (customUrl) {
      playCustomSound(customUrl);
      return;
    }
    playNotificationSound();
    // Beri jeda kecil supaya suara perintah tidak tabrakan dengan bunyi beep
    setTimeout(() => playVoiceAlert(), 650);
  }, [soundEnabled, playCustomSound, playNotificationSound, playVoiceAlert]);

  // Ref supaya loadOrders (dipanggil dari closure setInterval) selalu memanggil
  // versi playNewOrderAlert TERBARU tanpa perlu loadOrders di-recreate tiap render.
  const playNewOrderAlertRef = useRef(playNewOrderAlert);
  useEffect(() => {
    playNewOrderAlertRef.current = playNewOrderAlert;
  }, [playNewOrderAlert]);

  // Ambil URL suara notifikasi kustom dari pengaturan (endpoint publik, tidak butuh login),
  // lalu polling berkala kalau admin upload/hapus mp3 saat Kitchen sedang terbuka.
  useEffect(() => {
    let cancelled = false;

    async function pollSettings() {
      try {
        const data = await api.getStoreStatus();
        if (cancelled) return;
        customSoundUrlRef.current = data?.notification_sound_url || "";
      } catch {
        /* gagal ambil setelan — coba lagi di polling berikutnya, abaikan */
      }
    }

    pollSettings();
    const interval = setInterval(pollSettings, SETTINGS_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Lapis 1 - opportunistic unlock: kalau audio belum aktif (mis. halaman reload dan token
  // "auto-login" lewat sessionStorage, sehingga layar login & handleLoginSubmit()->unlockAudio()
  // terlewati sama sekali), pasang listener gesture GLOBAL. Sentuhan/klik/keyboard apa pun di
  // halaman ini (geser tab, update status order, dll) akan otomatis meng-unlock audio tanpa staff
  // perlu sadar ada masalah. Semua ini murni di memory browser (bukan panggilan server), begitu
  // audio berhasil unlock listener langsung dilepas -> tidak ada overhead tambahan setelahnya.
  useEffect(() => {
    if (audioUnlocked) return;
    const handler = () => unlockAudio();
    const events = ["pointerdown", "keydown"];
    events.forEach((evt) => window.addEventListener(evt, handler, { passive: true }));
    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handler));
    };
  }, [audioUnlocked, unlockAudio]);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("kitchen_sound_enabled", next ? "1" : "0");
      if (next) unlockAudio();
      return next;
    });
  }, [unlockAudio]);

  // Polling order: ambil daftar order tiap beberapa detik. Fetch pertama dilakukan
  // segera saat token tersedia (mis. setelah login), lalu berkala setelahnya.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    knownOrderIdsRef.current = null; // reset deteksi "order baru" tiap kali token berganti (login ulang)

    async function tick() {
      if (cancelled) return;
      await loadOrders();
    }

    tick();
    const interval = setInterval(tick, ORDERS_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const updateStatus = useCallback(
    async (order, status) => {
      await api.updateOrderStatus(token, order.id, status);
      // Refresh segera setelah update supaya dashboard tidak menunggu siklus polling berikutnya.
      await loadOrders();
    },
    [token, loadOrders]
  );

  return { orders, connected, soundEnabled, audioUnlocked, toggleSound, unlockAudio, updateStatus };
}
