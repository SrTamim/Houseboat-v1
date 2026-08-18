'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  Suspense,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AuthModal } from './AuthModal';
import {
  AUTH_PARAM,
  NEXT_PARAM,
  REASON_PARAM,
  safeCustomerNext,
  type AuthMode,
  type CustomerLoginReason,
} from '@/lib/customer/login-url';

interface OpenOpts {
  /** Where to land after success. Clamped by safeCustomerNext. */
  next?: string | null;
  reason?: CustomerLoginReason;
}

interface AuthModalApi {
  openAuth: (mode: AuthMode, opts?: OpenOpts) => void;
  closeAuth: () => void;
}

const Ctx = createContext<AuthModalApi | null>(null);

/**
 * Read it anywhere under the customer layout to open the sign-in modal.
 *
 * Returns a no-op outside the provider rather than throwing: the nav and a few
 * shared components also render inside the owner/admin trees, and a missing
 * modal should never crash a page.
 */
export function useAuthModal(): AuthModalApi {
  const ctx = useContext(Ctx);
  return (
    ctx ?? {
      openAuth: () => {},
      closeAuth: () => {},
    }
  );
}

interface ModalState {
  mode: AuthMode;
  next: string | null;
  reason: string | null;
}

/**
 * Owns the customer auth modal for the whole customer surface.
 *
 * Two ways in:
 *  1. openAuth() from any client component — the normal path, no URL change.
 *  2. ?auth=login|register on the URL — for callers that only control a URL
 *     (the axios refresh-failure bounce, a server-side redirect, an old
 *     bookmark). Consumed and stripped on mount so a reload doesn't reopen it.
 *
 * On success it runs router.refresh(), which re-runs the server components —
 * including getCustomerSession() — so the nav flips to signed-in without a
 * reload and without any client-side session store to keep in sync.
 */
function AuthModalHost({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [state, setState] = useState<ModalState | null>(null);

  const openAuth = useCallback((mode: AuthMode, opts: OpenOpts = {}) => {
    setState({
      mode,
      next: safeCustomerNext(opts.next) ?? null,
      reason: opts.reason ?? null,
    });
  }, []);

  const closeAuth = useCallback(() => setState(null), []);

  // URL-driven open. Runs on every param change, not just mount, so a bounce
  // that lands on the page we're already on still opens the modal.
  useEffect(() => {
    const raw = params.get(AUTH_PARAM);
    if (raw !== 'login' && raw !== 'register') return;

    setState({
      mode: raw,
      next: safeCustomerNext(params.get(NEXT_PARAM)),
      reason: params.get(REASON_PARAM),
    });

    // Strip the auth params so a refresh (or a later back-nav) doesn't reopen.
    const stripped = new URLSearchParams(params.toString());
    stripped.delete(AUTH_PARAM);
    stripped.delete(NEXT_PARAM);
    stripped.delete(REASON_PARAM);
    const qs = stripped.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  const onSuccess = useCallback(() => {
    const dest = state?.next ?? null;
    setState(null);
    if (dest && dest !== pathname) {
      // A destination was requested (e.g. bounced off /account/trips) — go
      // there. push() runs the server components fresh, so no refresh needed.
      router.push(dest);
    } else {
      // Stay put and re-run the RSC tree so the new cookie is picked up.
      router.refresh();
    }
  }, [state, pathname, router]);

  const api = useMemo(() => ({ openAuth, closeAuth }), [openAuth, closeAuth]);

  return (
    <Ctx.Provider value={api}>
      {children}
      {state ? (
        <AuthModal
          mode={state.mode}
          reason={state.reason}
          onModeChange={(mode) => setState((s) => (s ? { ...s, mode } : s))}
          onClose={closeAuth}
          onSuccess={onSuccess}
        />
      ) : null}
    </Ctx.Provider>
  );
}

/**
 * useSearchParams() opts the subtree into client-side rendering unless it sits
 * under a Suspense boundary, which would deopt every customer page to CSR.
 */
export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={children}>
      <AuthModalHost>{children}</AuthModalHost>
    </Suspense>
  );
}
