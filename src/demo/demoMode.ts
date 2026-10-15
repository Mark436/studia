// Single source of truth for the `?demo` showcase gate. The check itself is
// tiny on purpose: it has to run before the app mounts (main.tsx) and is also
// read by the shell to know whether to render the demo guide, so both the real
// bundle and the demo share this one definition.

export function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("demo");
}
