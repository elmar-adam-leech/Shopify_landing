import { useCallback } from "react";
import { useLocation } from "wouter";

/**
 * Hook to navigate while preserving shop/host URL parameters for embedded Shopify apps.
 * This ensures the embedded context is maintained across page navigations.
 */
export function useEmbeddedNavigation() {
  const [, setLocation] = useLocation();

  const getEmbeddedParams = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const shop = params.get("shop");
    const host = params.get("host");
    
    if (shop && host) {
      return `?shop=${encodeURIComponent(shop)}&host=${encodeURIComponent(host)}`;
    }
    return "";
  }, []);

  const navigate = useCallback((path: string, options?: { replace?: boolean }) => {
    const embeddedParams = getEmbeddedParams();
    const fullPath = embeddedParams ? `${path}${embeddedParams}` : path;
    setLocation(fullPath, options);
  }, [getEmbeddedParams, setLocation]);

  const buildHref = useCallback((path: string) => {
    const embeddedParams = getEmbeddedParams();
    return embeddedParams ? `${path}${embeddedParams}` : path;
  }, [getEmbeddedParams]);

  return { navigate, buildHref, getEmbeddedParams };
}
