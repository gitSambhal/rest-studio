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
 * Ensures Cmd+A (Select All), Cmd+C (Copy), Cmd+X (Cut), Cmd+V (Paste), Cmd+Z (Undo), Cmd+Shift+Z / Cmd+Y (Redo)
 * work reliably in macOS WKWebView (Neutralino/Tauri/Browser) and Windows/Linux.
 */
export function initDesktopClipboardHandlers() {
  if (typeof window === 'undefined') return;

  // Keydown shortcut handler (capture phase)
  window.addEventListener(
    'keydown',
    async (e: KeyboardEvent) => {
      // Check if Command (macOS e.metaKey) or Ctrl (Windows/Linux e.ctrlKey) is pressed
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (!isCmdOrCtrl) return;

      const key = e.key ? e.key.toLowerCase() : '';
      const activeEl = document.activeElement as HTMLElement | null;
      const isInputOrTextarea =
        activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
      const isContentEditable = activeEl && (activeEl.isContentEditable || activeEl.getAttribute('contenteditable') === 'true');
      const isEditable = isInputOrTextarea || isContentEditable;

      // 1. SELECT ALL (Cmd+A / Ctrl+A)
      if (key === 'a') {
        if (isInputOrTextarea) {
          (activeEl as HTMLInputElement | HTMLTextAreaElement).select();
          e.preventDefault();
        } else if (isContentEditable) {
          try {
            document.execCommand('selectAll', false);
          } catch (_) {}
          e.preventDefault();
        } else {
          try {
            const selection = window.getSelection();
            if (selection && document.body) {
              const range = document.createRange();
              range.selectNodeContents(document.body);
              selection.removeAllRanges();
              selection.addRange(range);
            }
          } catch (_) {}
          e.preventDefault();
        }
        return;
      }

      // 2. COPY (Cmd+C / Ctrl+C)
      if (key === 'c') {
        let selectedText = '';
        if (isInputOrTextarea) {
          const input = activeEl as HTMLInputElement | HTMLTextAreaElement;
          const start = input.selectionStart ?? 0;
          const end = input.selectionEnd ?? 0;
          if (start !== end) {
            selectedText = input.value.substring(start, end);
          }
        } else {
          selectedText = window.getSelection()?.toString() || '';
        }

        if (selectedText) {
          e.preventDefault();
          writeClipboardText(selectedText);
        }
        return;
      }

      // 3. CUT (Cmd+X / Ctrl+X)
      if (key === 'x') {
        if (!isEditable) return;

        if (isInputOrTextarea) {
          const input = activeEl as HTMLInputElement | HTMLTextAreaElement;
          if (input.readOnly || input.disabled) return;

          const start = input.selectionStart ?? 0;
          const end = input.selectionEnd ?? 0;
          if (start !== end) {
            e.preventDefault();
            const selectedText = input.value.substring(start, end);
            writeClipboardText(selectedText);
            const val = input.value;
            const newVal = val.substring(0, start) + val.substring(end);
            setNativeInputValue(input, newVal);
            input.setSelectionRange(start, start);
          }
        } else if (isContentEditable) {
          const selectedText = window.getSelection()?.toString() || '';
          if (selectedText) {
            e.preventDefault();
            writeClipboardText(selectedText);
            try {
              document.execCommand('delete', false);
            } catch (_) {}
          }
        }
        return;
      }

      // 4. PASTE (Cmd+V / Ctrl+V)
      if (key === 'v') {
        if (!isEditable) return;

        if (isInputOrTextarea) {
          const input = activeEl as HTMLInputElement | HTMLTextAreaElement;
          if (input.readOnly || input.disabled) return;

          e.preventDefault(); // Prevent default synchronously
          const text = await readClipboardText();
          if (text) {
            const start = input.selectionStart ?? input.value.length;
            const end = input.selectionEnd ?? input.value.length;
            const val = input.value;
            const newVal = val.substring(0, start) + text + val.substring(end);
            setNativeInputValue(input, newVal);
            const newPos = start + text.length;
            input.setSelectionRange(newPos, newPos);
          }
        } else if (isContentEditable) {
          e.preventDefault(); // Prevent default synchronously
          const text = await readClipboardText();
          if (text) {
            try {
              document.execCommand('insertText', false, text);
            } catch (_) {}
          }
        }
        return;
      }

      // 5. UNDO (Cmd+Z / Ctrl+Z)
      if (key === 'z' && !e.shiftKey) {
        if (isEditable) {
          try {
            document.execCommand('undo');
          } catch (_) {}
        }
        return;
      }

      // 6. REDO (Cmd+Shift+Z / Cmd+Y / Ctrl+Y / Ctrl+Shift+Z)
      if ((key === 'z' && e.shiftKey) || key === 'y') {
        if (isEditable) {
          try {
            document.execCommand('redo');
          } catch (_) {}
        }
        return;
      }
    },
    true // Capture phase to handle events before child stopPropagation
  );
}
