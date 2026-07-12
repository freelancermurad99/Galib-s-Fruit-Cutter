import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

declare global {
  interface Window {
    FBInstant: any;
  }
}

const renderApp = () => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
};

if (typeof window.FBInstant !== "undefined") {
  window.FBInstant.initializeAsync().then(() => {
    window.FBInstant.setLoadingProgress(100);
    window.FBInstant.startGameAsync().then(() => {
      renderApp();
    });
  });
} else {
  // Run normally if not inside Facebook Instant Games
  renderApp();
}
