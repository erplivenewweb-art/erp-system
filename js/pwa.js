"use strict";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch((error) => {
      console.warn("Service worker registration failed:", error);
    });
  });
}

document.addEventListener("wheel", (event) => {
  const activeInput = document.activeElement;
  if (!activeInput || !activeInput.matches?.('input[type="number"]')) return;

  if (event.target === activeInput) {
    activeInput.blur();
  }
}, { capture: true });
