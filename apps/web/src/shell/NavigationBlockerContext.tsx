import { createContext, useContext, useRef, useCallback, useEffect, type ReactNode } from 'react';

type BlockerCallback = (nextPath: string) => boolean | Promise<boolean>;

export interface NavigationBlockerContextType {
  registerBlocker: (id: string, callback: BlockerCallback) => void;
  unregisterBlocker: (id: string) => void;
  navigateWithBlockCheck: (path: string) => Promise<boolean>;
}

export const NavigationBlockerContext = createContext<NavigationBlockerContextType | undefined>(
  undefined,
);

export function NavigationBlockerProvider({
  onNavigate,
  children,
}: {
  onNavigate: (path: string) => void;
  children: ReactNode;
}) {
  const blockersRef = useRef<Map<string, BlockerCallback>>(new Map());

  const registerBlocker = useCallback((id: string, callback: BlockerCallback) => {
    blockersRef.current.set(id, callback);
  }, []);

  const unregisterBlocker = useCallback((id: string) => {
    blockersRef.current.delete(id);
  }, []);

  const navigateWithBlockCheck = useCallback(
    async (path: string) => {
      for (const callback of Array.from(blockersRef.current.values())) {
        const allowed = await callback(path);
        if (!allowed) {
          return false;
        }
      }
      onNavigate(path);
      return true;
    },
    [onNavigate],
  );

  return (
    <NavigationBlockerContext.Provider
      value={{ registerBlocker, unregisterBlocker, navigateWithBlockCheck }}
    >
      {children}
    </NavigationBlockerContext.Provider>
  );
}

export function useNavigationBlocker(
  id: string,
  isBlocked: boolean,
  onBlockedNavigation: (nextPath: string) => void,
) {
  const ctx = useContext(NavigationBlockerContext);

  useEffect(() => {
    if (!ctx) return;

    if (!isBlocked) {
      ctx.unregisterBlocker(id);
      return;
    }

    ctx.registerBlocker(id, (nextPath: string) => {
      onBlockedNavigation(nextPath);
      return false;
    });

    return () => {
      ctx.unregisterBlocker(id);
    };
  }, [ctx, id, isBlocked, onBlockedNavigation]);
}
