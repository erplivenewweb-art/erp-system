"use strict";

(function protectPage() {
  const currentPage = String(window.location.pathname || "")
    .split("/")
    .pop()
    .toLowerCase();

  if (!currentPage || currentPage === "login.html" || currentPage === "index.html") {
    return;
  }

  try {
    const user = JSON.parse(localStorage.getItem("erpLoggedInUser") || "null");
    if (!user) {
      window.location.replace("login.html");
    }
  } catch (_) {
    window.location.replace("login.html");
  }
})();
