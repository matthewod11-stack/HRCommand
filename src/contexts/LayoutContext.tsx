import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface LayoutState {
  sidebarOpen: boolean;
  contextPanelOpen: boolean;
}

interface LayoutContextValue extends LayoutState {
  toggleSidebar: () => void;
  toggleContextPanel: () => void;
  setSidebarOpen: (open: boolean) => void;
  setContextPanelOpen: (open: boolean) => void;
}

const LayoutContext = createContext<LayoutContextValue | null>(null);

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LayoutState>({
    sidebarOpen: true,
    contextPanelOpen: true,
  });

  const toggleSidebar = useCallback(() => {
    setState(prev => ({ ...prev, sidebarOpen: !prev.sidebarOpen }));
  }, []);

  const toggleContextPanel = useCallback(() => {
    setState(prev => ({ ...prev, contextPanelOpen: !prev.contextPanelOpen }));
  }, []);

  const setSidebarOpen = useCallback((open: boolean) => {
    setState(prev => ({ ...prev, sidebarOpen: open }));
  }, []);

  const setContextPanelOpen = useCallback((open: boolean) => {
    setState(prev => ({ ...prev, contextPanelOpen: open }));
  }, []);

  return (
    <LayoutContext.Provider
      value={{
        ...state,
        toggleSidebar,
        toggleContextPanel,
        setSidebarOpen,
        setContextPanelOpen,
      }}
    >
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
}
