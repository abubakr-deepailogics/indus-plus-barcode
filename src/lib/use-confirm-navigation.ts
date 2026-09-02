"use client";

import { useEffect, useRef } from "react";

const DEFAULT_MESSAGE =
  "Are you sure you want to leave this page? Any unsaved scanning data will be lost.";

export function useConfirmNavigation(
  active: boolean,
  message: string = DEFAULT_MESSAGE,
) {
  const messageRef = useRef(message);

  useEffect(() => {
    messageRef.current = message;
  }, [message]);

  useEffect(() => {
    if (!active) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    const handleClick = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }

      const anchor = (e.target as HTMLElement | null)?.closest(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (!anchor || anchor.hasAttribute("download")) return;
      if (anchor.target && anchor.target !== "_self") return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }

      if (!window.confirm(messageRef.current)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };

    // Sentinel entry so the first Back press pops it (firing `popstate`
    // without actually leaving) instead of immediately navigating away.
    const trapState = window.history.state;
    window.history.pushState(trapState, "", window.location.href);

    const handlePopState = () => {
      if (window.confirm(messageRef.current)) {
        window.removeEventListener("popstate", handlePopState);
        window.history.back();
      } else {
        window.history.pushState(trapState, "", window.location.href);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleClick, true);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [active]);
}
