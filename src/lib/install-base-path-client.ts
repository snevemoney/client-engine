import { apiPath, getBasePath, shouldPrefixClientPath } from "./base-path";

declare global {
  interface Window {
    __hiveBasePathInstalled?: boolean;
  }
}

/** Patch fetch + EventSource for /pro path deploy */
export function installBasePathClient(): void {
  if (typeof window === "undefined") return;

  const base = getBasePath();
  if (!base || window.__hiveBasePathInstalled) return;
  window.__hiveBasePathInstalled = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (typeof input === "string" && shouldPrefixClientPath(input)) {
      return originalFetch(apiPath(input), init);
    }
    if (input instanceof Request) {
      try {
        const { pathname, search } = new URL(input.url, window.location.origin);
        const combined = `${pathname}${search}`;
        if (shouldPrefixClientPath(combined)) {
          return originalFetch(new Request(apiPath(combined), input), init);
        }
      } catch {
        /* fall through */
      }
    }
    return originalFetch(input, init);
  };

  const OriginalEventSource = window.EventSource;
  if (!OriginalEventSource) return;

  const PatchedEventSource = function (
    this: EventSource,
    url: string | URL,
    init?: EventSourceInit
  ): EventSource {
    if (typeof url === "string" && shouldPrefixClientPath(url)) {
      return new OriginalEventSource(apiPath(url), init);
    }
    return new OriginalEventSource(url, init);
  } as unknown as typeof EventSource;

  PatchedEventSource.prototype = OriginalEventSource.prototype;
  window.EventSource = PatchedEventSource;
}
