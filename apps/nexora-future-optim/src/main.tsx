import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./theme/polices";
import "./optim/optim.css";
import "./optim/app.css";
import { App } from "./App";

createRoot(document.getElementById("racine")!).render(<StrictMode><App /></StrictMode>);
