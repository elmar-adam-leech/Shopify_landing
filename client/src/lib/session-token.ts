export async function getSessionToken(app?: unknown): Promise<string | null> {
  const appInstance = app || (window as any).__SHOPIFY_APP_BRIDGE__;
  if (!appInstance) return null;

  try {
    const { getSessionToken: getBridgeToken } = await import("@shopify/app-bridge/utilities");
    return await getBridgeToken(appInstance);
  } catch (error) {
    console.error("[SessionToken] Failed to get session token:", error);
    return null;
  }
}
