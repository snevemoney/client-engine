"use client";

import { useLayoutEffect } from "react";
import { installBasePathClient } from "@/lib/install-base-path-client";

export function BasePathInstaller() {
  useLayoutEffect(() => {
    installBasePathClient();
  }, []);
  return null;
}
