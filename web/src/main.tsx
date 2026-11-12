import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./theme.css";
import "./app.css";
import { preloadSamples } from "./sounds";
import { applyTheme, savedTheme } from "./theme";

applyTheme(savedTheme());
void preloadSamples();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
