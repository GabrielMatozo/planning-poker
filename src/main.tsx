import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { installDevToolsDeterrent } from "./app/anti-debug";
import { ErrorBoundary } from "./ui/ErrorBoundary";
import "./styles/globals.css";

const container = document.getElementById("root");
if (!container) throw new Error("Elemento #root não encontrado");

installDevToolsDeterrent();

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
