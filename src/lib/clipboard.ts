// navigator.clipboard.writeText only exists in a "secure context" (HTTPS,
// or localhost) — an admin panel served over plain HTTP (no TLS/reverse
// proxy in front of it) has `navigator.clipboard` simply undefined, or the
// call throws/rejects (e.g. permission denied) even where it does exist.
// Every "Sao chép" button in this app used to call it directly and
// unconditionally assume success — a real, reported bug: the click did
// nothing, with no visible error and no fallback.
//
// copyToClipboard tries the modern API first, then falls back to the
// classic `document.execCommand('copy')` trick via a temporary offscreen
// <textarea> — deprecated, but still functional in every browser that
// matters here specifically for this fallback use case, and the only way
// to copy text at all outside a secure context. Returns whether it
// actually succeeded, so a caller can show real "copied"/"failed" feedback
// instead of a fake instant checkmark before the browser even finished
// wearing the outcome.
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy fallback below — e.g. insecure context
    // (NotAllowedError/undefined API) or a denied permission.
  }
  return legacyCopy(text);
}

function legacyCopy(text: string): boolean {
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    // Fully offscreen and out of tab order, but still focusable/selectable
    // — both required for execCommand('copy') to find a real selection.
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    textarea.setAttribute('readonly', '');
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length); // iOS Safari needs this explicitly
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
