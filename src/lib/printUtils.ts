/**
 * Utilitas Pencetakan Lintas Platform Tanabrew (Web, iOS WKWebView, Android)
 * Menyediakan mekanisme pencetakan tangguh untuk mengatasi pemblokiran pop-up
 * pada perangkat iOS (iPhone/iPad) dan browser seluler melalui iframe tersembunyi.
 */

export const printHtmlViaIframe = (html: string): Promise<boolean> => {
  return new Promise((resolve) => {
    try {
      // Bersihkan iframe cetak sebelumnya jika masih ada di DOM
      const previousIframe = document.getElementById("tanabrew-print-iframe");
      if (previousIframe) {
        previousIframe.remove();
      }

      const iframe = document.createElement("iframe");
      iframe.id = "tanabrew-print-iframe";
      iframe.style.position = "fixed";
      iframe.style.left = "-9999px";
      iframe.style.top = "0";
      iframe.style.width = "1px";
      iframe.style.height = "1px";
      iframe.style.opacity = "0";
      iframe.style.border = "0";
      iframe.setAttribute("aria-hidden", "true");
      document.body.appendChild(iframe);

      const idoc = iframe.contentWindow?.document;
      if (!idoc) {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
        resolve(false);
        return;
      }

      idoc.open();
      idoc.write(html);
      idoc.close();

      let printExecuted = false;

      const executePrint = () => {
        if (printExecuted) return;
        printExecuted = true;

        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          resolve(true);
        } catch (err) {
          console.warn("[Tanabrew Print] Gagal memanggil print pada iframe:", err);
          resolve(false);
        } finally {
          // Bersihkan iframe setelah jeda waktu agar proses AirPrint selesai
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 4000);
        }
      };

      if (idoc.readyState === "complete") {
        setTimeout(executePrint, 350);
      } else {
        iframe.contentWindow?.addEventListener("load", () => {
          setTimeout(executePrint, 250);
        }, { once: true });

        // Batas waktu cadangan jika event load tidak terpanggil
        setTimeout(executePrint, 1000);
      }
    } catch (err) {
      console.error("[Tanabrew Print] Eksepsi pada printHtmlViaIframe:", err);
      resolve(false);
    }
  });
};
