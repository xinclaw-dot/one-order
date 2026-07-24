// ============================================
// Durable Object: OrderStream
// Menyimpan koneksi SSE yang sedang terbuka (dashboard kitchen/kasir/admin)
// dan broadcast event ke semua koneksi saat ada order baru / status berubah.
//
// PERBAIKAN PENTING (menyebabkan "selalu terputus" / 503 di /orders/stream
// dan /settings/stream):
//
// Versi sebelumnya menyimpan `ReadableStreamDefaultController` (objek I/O)
// di `this.controllers`, lalu memanggil `controller.enqueue()` dari request
// LAIN (saat endpoint /broadcast dipanggil oleh order baru/verifikasi
// pembayaran, dst). Cloudflare Workers MELARANG ini dengan tegas:
//
//   "Cannot perform I/O on behalf of a different request. I/O objects
//   (such as streams, request/response bodies, and others) created in the
//   context of one request handler cannot be accessed from a different
//   request's handler."
//
// Saat aturan ini dilanggar, Cloudflare bisa mematikan/me-reset instance
// Durable Object tersebut secara paksa. Karena broadcast() dipanggil setiap
// kali ada order baru/verifikasi/dsb, siklus ini terus berulang → Durable
// Object jadi tidak stabil → subscribeStream() di index.js menangkap error
// tsb lalu balas 503 → browser (EventSource) membaca status 503 sebagai
// KEGAGALAN PERMANEN dan TIDAK reconnect otomatis (beda dgn network error
// biasa) → dashboard jadi "Terputus..." terus-menerus.
//
// SOLUSI: jangan pernah simpan/panggil stream controller dari request lain.
// Sebagai gantinya, setiap koneksi /subscribe punya loop async miliknya
// sendiri (tetap berjalan di request context aslinya) yang menunggu sinyal
// "ada data baru" lewat Promise biasa (BUKAN objek I/O, jadi aman dipanggil
// lintas-request). broadcast()/wake() hanya me-resolve Promise itu — begitu
// resolve terpanggil, `await` di dalam loop tsb otomatis lanjut MASIH di
// request context asalnya sendiri, sehingga enqueue() ke controller aman.
// ============================================

export class OrderStream {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    // Set of resolver function (fungsi JS biasa — bukan objek I/O — jadi
    // aman dipanggil dari request/broadcast context yang berbeda).
    this.waiters = new Set();
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/subscribe") {
      return this.handleSubscribe();
    }

    if (url.pathname === "/broadcast" && request.method === "POST") {
      const payload = await request.text();
      this.wake(payload);
      return new Response("ok");
    }

    return new Response("not found", { status: 404 });
  }

  // Bangunkan semua koneksi yang sedang menunggu data baru. Hanya memanggil
  // fungsi resolve() biasa (aman lintas-request) — TIDAK menyentuh stream
  // controller sama sekali dari sini.
  wake(payload) {
    const waiters = this.waiters;
    this.waiters = new Set();
    for (const resolve of waiters) {
      try {
        resolve(payload);
      } catch {
        // abaikan, koneksi terkait akan otomatis berhenti lewat cancel()
      }
    }
  }

  handleSubscribe() {
    const encoder = new TextEncoder();
    const waiters = this.waiters;
    let stopped = false;

    const stream = new ReadableStream({
      start: async (controller) => {
        try {
          controller.enqueue(encoder.encode(`: connected\n\n`));
        } catch {
          return;
        }

        // Heartbeat berkala supaya koneksi tidak dianggap idle & ditutup
        // oleh browser/proxy di tengah jalan (juga membantu mendeteksi lebih
        // cepat kalau koneksi sudah putus di sisi client).
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: ping\n\n`));
          } catch {
            stopped = true;
            clearInterval(heartbeat);
          }
        }, 25000);

        try {
          // Loop ini tetap berjalan sebagai kelanjutan (continuation) dari
          // request /subscribe yang sama, sehingga enqueue() di bawah selalu
          // terjadi di request context yang benar — walau "dibangunkan" dari
          // request /broadcast yang berbeda.
          while (!stopped) {
            const payload = await new Promise((resolve) => waiters.add(resolve));
            if (stopped) break;
            controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
          }
        } catch {
          // Client sudah menutup koneksi / controller sudah tidak valid.
        } finally {
          clearInterval(heartbeat);
          try {
            controller.close();
          } catch {
            // sudah tertutup, abaikan
          }
        }
      },
      cancel: () => {
        // Client memutus koneksi (tutup tab/refresh). Tandai berhenti supaya
        // loop di atas tidak lagi mencoba enqueue ke controller yang sudah mati.
        stopped = true;
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}
