import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { MetaverseShell } from "./app/metaverse-shell";
import "./styles/global.css";

const rootElement = document.querySelector<HTMLDivElement>("#app");

if (rootElement === null) {
  throw new Error("WebGPU Metaverse root element was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <MetaverseShell />
  </StrictMode>
);
