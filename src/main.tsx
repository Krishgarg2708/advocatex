import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { applyTheme, useUIStore } from "./store/ui";
import { useDataStore } from "./store/data";
import "./index.css";

applyTheme(useUIStore.getState().theme);
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (useUIStore.getState().theme === "system") applyTheme("system");
});

// Persist the freshly generated demo dataset on first visit so ids and dates stay stable across reloads.
try {
  if (!localStorage.getItem("advx-data")) useDataStore.setState({});
} catch { /* storage unavailable — demo still runs in memory */ }

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
