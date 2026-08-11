/**
 * Desktop & Neutralino Clipboard & Selection Helper
 * Fixes copy, paste, cut, select all, and right-click text selection issues in Neutralino (nue build), Tauri, and WebViews.
 */

// Helper to set React input/textarea values cleanly so React state handlers fire
function setNativeInputValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = element instanceof HTMLInputElement 
    ? window.HTMLInputElement.prototype 
    : window.HTMLTextAreaElement.prototype;
  
  const valueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  if (valueSetter) {
    valueSetter.call(element, value);
  } else {
    element.value = value;
  }
  
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Get text from Clipboard (tries Neutralino, Tauri, then browser navigator.clipboard)
 */
export async function readClipboardText(): Promise<string> {
  if (typeof window === 'undefined') return '';
  const w = window as any;

  // 1. Neutralino Clipboard API
  if (w.Neutralino?.clipboard?.readText) {
    try {
      const text = await w.Neutralino.clipboard.readText();
      if (typeof text === 'string') return text;
    } catch (_) {}
  }

  // 2. Tauri Clipboard API
  if (w.__TAURI__?.clipboard?.readText) {
    try {
      const text = await w.__TAURI__.clipboard.readText();
      if (typeof text === 'string') return text;
    } catch (_) {}
  }

  // 3. Browser Clipboard API
  if (navigator?.clipboard?.readText) {
    try {
      const text = await navigator.clipboard.readText();
      if (typeof text === 'string') return text;
    } catch (_) {}
  }

  return '';
}

/**
 * Write text to Clipboard (tries Neutralino, Tauri, then browser navigator.clipboard)
 */
export async function writeClipboardText(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const w = window as any;

  // 1. Neutralino
  if (w.Neutralino?.clipboard?.writeText) {
    try {
      await w.Neutralino.clipboard.writeText(text);
      return true;
    } catch (_) {}
  }

  // 2. Tauri
  if (w.__TAURI__?.clipboard?.writeText) {
    try {
      await w.__TAURI__.clipboard.writeText(text);
      return true;
    } catch (_) {}
  }

  // 3. Browser
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {}
  }

  // Fallback execCommand
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Initialize global clipboard handlers
 * Modern WebViews (WebView2, WebKit, Neutralino, Tauri) handle Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+A on HTML inputs natively.
 * We avoid intercepting keydown on inputs/textareas to prevent double pasting or interfering with OS clipboard pipelines.
 */
export function initDesktopClipboardHandlers() {
  // Native input/textarea copy-paste is handled cleanly by OS WebView
  return;
}
