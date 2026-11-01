import React from "react";
import ReactDOM from "react-dom/client";
import { DedicatedCatalogPage } from "./pages/DedicatedCatalogPage";
import "./index.css";

const root = document.getElementById("catalog-root");
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <DedicatedCatalogPage />
    </React.StrictMode>
  );
}
