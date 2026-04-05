import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { ThumbShooterScaffoldApp } from "./app/thumbshooter-scaffold-app";
import "./styles/global.css";

const rootElement = document.querySelector<HTMLDivElement>("#app");

if (rootElement === null) {
  throw new Error("ThumbShooter root element was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <ThumbShooterScaffoldApp />
  </StrictMode>
);
