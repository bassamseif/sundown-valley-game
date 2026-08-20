import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initAnalytics, track } from "./engine/analytics";

initAnalytics();
track("app_loaded");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
