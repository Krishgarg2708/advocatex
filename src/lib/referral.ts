/** Demo referral link builder. Uses the app's own hash route so the QR code points to a real page in this demo. */
export function referralLink(code: string) {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#/r/${encodeURIComponent(code)}`;
}

export function downloadCanvasPng(canvas: HTMLCanvasElement | null, filename: string) {
  if (!canvas) return false;
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png"); a.download = filename; a.click();
  return true;
}
