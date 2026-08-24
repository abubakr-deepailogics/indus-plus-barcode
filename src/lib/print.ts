/**
 * Loads a PDF URL inside an offscreen hidden iframe and triggers the native
 * browser print preview dialog. Cleans up the iframe after 1 minute.
 * Supports an optional onLoad callback to track when loading has finished.
 */
export function printPdf(url: string, onLoad?: () => void) {
  if (typeof window === "undefined") return;

  const iframe = document.createElement("iframe");
  iframe.style.position = "absolute";
  iframe.style.top = "-9999px";
  iframe.style.left = "-9999px";
  iframe.style.width = "800px";
  iframe.style.height = "600px";
  iframe.style.border = "0";
  iframe.src = url;

  document.body.appendChild(iframe);

  iframe.onload = () => {
    if (onLoad) {
      try {
        onLoad();
      } catch (e) {}
    }
    setTimeout(() => {
      if (iframe.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        
        // Remove the iframe after printing dialog is closed/canceled
        setTimeout(() => {
          try {
            document.body.removeChild(iframe);
          } catch (e) {
            // Ignore if already removed
          }
        }, 60000);
      }
    }, 800);
  };
}
