/**
 * useCommandPalette Hook
 *
 * Manages command palette state and global keyboard shortcuts.
 * Must be used within LayoutProvider.
 */

import { useState, useEffect, useCallback } from 'react';
import { useLayout } from '../contexts/LayoutContext';

interface UseCommandPaletteOptions {
  /** Callback to open the settings panel */
  onOpenSettings: () => void;
  /** Callback to focus the chat input */
  focusChatInput: () => void;
}

interface UseCommandPaletteReturn {
  /** Whether the command palette is open */
  isOpen: boolean;
  /** Open the command palette */
  open: () => void;
  /** Close the command palette */
  close: () => void;
  /** Toggle the command palette */
  toggle: () => void;
}

export function useCommandPalette({
  onOpenSettings,
  focusChatInput,
}: UseCommandPaletteOptions): UseCommandPaletteReturn {
  const [isOpen, setIsOpen] = useState(false);
  const { setSidebarTab, setSidebarOpen } = useLayout();

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  // Register global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea (except for Cmd+K which always works)
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      // Cmd+K - Toggle command palette (always works)
      if (e.metaKey && e.key === 'k') {
        e.preventDefault();
        toggle();
        return;
      }

      // Don't handle other shortcuts if palette is open (let palette handle them)
      if (isOpen) return;

      // Don't handle if typing in an input
      if (isTyping) return;

      // Cmd+/ - Focus chat input
      if (e.metaKey && e.key === '/') {
        e.preventDefault();
        focusChatInput();
        return;
      }

      // Cmd+E - Switch to employees tab
      if (e.metaKey && e.key === 'e') {
        e.preventDefault();
        setSidebarTab('employees');
        setSidebarOpen(true);
        return;
      }

      // Cmd+, - Open settings
      if (e.metaKey && e.key === ',') {
        e.preventDefault();
        onOpenSettings();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, toggle, focusChatInput, setSidebarTab, setSidebarOpen, onOpenSettings]);

  return {
    isOpen,
    open,
    close,
    toggle,
  };
}
