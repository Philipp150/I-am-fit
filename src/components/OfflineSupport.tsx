"use client";

import { useEffect } from "react";
import { listenOfflineDocumentNav, scheduleCatalogPrecache } from "@/lib/offline-cache";

export function OfflineSupport() {
  useEffect(() => {
    const stopNav = listenOfflineDocumentNav();
    const cancelPrecache = scheduleCatalogPrecache();
    return () => {
      stopNav();
      cancelPrecache();
    };
  }, []);
  return null;
}
