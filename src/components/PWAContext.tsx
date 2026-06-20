"use client";

import { useEffect, useState, useCallback } from "react";

import packageJson from "../../package.json";

// Local build version - bundled at build time
const APP_VERSION = packageJson.version;

export default function PWAContext() {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleApplyUpdate = useCallback(async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    
    try {
      // Unregister SW
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
          await reg.unregister();
        }
      }
      // Delete all browser caches completely to reset state
      if ("caches" in window) {
        const cacheNames = await caches.keys();
        for (const name of cacheNames) {
          await caches.delete(name);
        }
      }
    } catch (e) {
      console.error("Cache clear failed", e);
    }

    // Force a fresh reload from the server after a short visual delay
    setTimeout(() => {
      window.location.reload();
    }, 500);
  }, [isUpdating]);

  useEffect(() => {
    // 1. Register the Service Worker
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => console.log("PWA Service Worker registered", reg.scope))
          .catch((err) => console.error("PWA Service Worker registration failed", err));
      });
    }

    // 2. Poll for Version Mismatches
    const checkVersion = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`);
        if (!res.ok) return;
        const data = await res.json();
        
        if (data.version && data.version !== APP_VERSION) {
          // Auto update triggered
          handleApplyUpdate();
        }
      } catch (err) {
        console.error("Failed to check app version", err);
      }
    };
    
    checkVersion();
  }, [handleApplyUpdate]);

  return null;
}
