import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { ThumbShooterShell } from "./app/thumbshooter-shell";
import "./styles/global.css";

const rootElement = document.querySelector<HTMLDivElement>("#app");

if (rootElement === null) {
  throw new Error("ThumbShooter root element was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <ThumbShooterShell />
  </StrictMode>
);
