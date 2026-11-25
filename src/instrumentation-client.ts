import { addBreadcrumb, installClientObservability } from "@/lib/logger/client";

// Runs before hydration: capture uncaught errors, unhandled rejections and
// failed /api calls from the very first render. See src/lib/logger/client.ts.
installClientObservability();

export function onRouterTransitionStart(url: string, navigationType: "push" | "replace" | "traverse") {
  addBreadcrumb("navigation", `${navigationType} ${url}`);
}
