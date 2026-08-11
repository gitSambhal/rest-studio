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
 * Initialize global keyboard listeners for Cmd/Ctrl + C, V, X, A
 * This explicitly ensures Neutralino and WebViews handle copy, paste, cut, and select all on inputs, textareas, and selectable response text!
 */
export function initDesktopClipboardHandlers() {
  if (typeof window === 'undefined') return;

  const handleKeyDown = async (e: KeyboardEvent) => {
    const isCmdOrCtrl = e.metaKey || e.ctrlKey;
    if (!isCmdOrCtrl) return;

    const key = e.key ? e.key.toLowerCase() : '';
    const activeEl = document.activeElement as HTMLElement | null;
    const isInputOrTextarea = !!(
      activeEl && (
        activeEl.tagName === 'INPUT' || 
        activeEl.tagName === 'TEXTAREA' || 
        activeEl.isContentEditable
      )
    );

    // --- PASTE (Cmd+V / Ctrl+V) ---
    if (key === 'v') {
      if (isInputOrTextarea && activeEl) {
        const pastedText = await readClipboardText();
        if (pastedText) {
          e.preventDefault();
          if (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') {
            const inputEl = activeEl as HTMLInputElement | HTMLTextAreaElement;
            const start = inputEl.selectionStart ?? inputEl.value.length;
            const end = inputEl.selectionEnd ?? inputEl.value.length;
            const currentVal = inputEl.value || '';
            const newVal = currentVal.substring(0, start) + pastedText + currentVal.substring(end);
            
            setNativeInputValue(inputEl, newVal);
            inputEl.selectionStart = inputEl.selectionEnd = start + pastedText.length;
          } else if (activeEl.isContentEditable) {
            document.execCommand('insertText', false, pastedText);
          }
        }
      }
    }

    // --- COPY (Cmd+C / Ctrl+C) ---
    if (key === 'c') {
      let textToCopy = '';
      if (isInputOrTextarea && (activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA')) {
        const inputEl = activeEl as HTMLInputElement | HTMLTextAreaElement;
        const start = inputEl.selectionStart ?? 0;
        const end = inputEl.selectionEnd ?? 0;
        if (start !== end) {
          textToCopy = inputEl.value.substring(start, end);
        }
      } else {
        const selection = window.getSelection();
        if (selection && selection.toString()) {
          textToCopy = selection.toString();
        }
      }

      if (textToCopy) {
        e.preventDefault();
        await writeClipboardText(textToCopy);
      }
    }

    // --- CUT (Cmd+X / Ctrl+X) ---
    if (key === 'x') {
      if (isInputOrTextarea && (activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA')) {
        const inputEl = activeEl as HTMLInputElement | HTMLTextAreaElement;
        const start = inputEl.selectionStart ?? 0;
        const end = inputEl.selectionEnd ?? 0;
        if (start !== end) {
          e.preventDefault();
          const textToCut = inputEl.value.substring(start, end);
          await writeClipboardText(textToCut);
          const currentVal = inputEl.value || '';
          const newVal = currentVal.substring(0, start) + currentVal.substring(end);
          setNativeInputValue(inputEl, newVal);
          inputEl.selectionStart = inputEl.selectionEnd = start;
        }
      }
    }

    // --- SELECT ALL (Cmd+A / Ctrl+A) ---
    if (key === 'a') {
      if (isInputOrTextarea && (activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA')) {
        e.preventDefault();
        (activeEl as HTMLInputElement | HTMLTextAreaElement).select();
      }
    }
  };

  window.addEventListener('keydown', handleKeyDown, true);
}
