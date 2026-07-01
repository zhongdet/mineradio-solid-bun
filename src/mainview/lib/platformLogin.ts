// @ts-nocheck
import { useAuth } from "../stores/authStore";

function hasPlatformLogin(provider: string): boolean {
  const auth = useAuth();
  if (provider === "netease") return !!(auth.state.loginStatus && auth.state.loginStatus.loggedIn);
  if (provider === "qq") return !!(auth.state.qqLoginStatus && auth.state.qqLoginStatus.loggedIn);
  return false;
}

export function hasAnyPlatformLogin(): boolean {
  return hasPlatformLogin("netease") || hasPlatformLogin("qq");
}
