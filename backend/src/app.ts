import express from "express";
import cors from "cors";
import { consultantRoutes }  from "./modules/consultants/consultant.routes";
import { projectRoutes }     from "./modules/projects/project.routes";
import { simulationRoutes }  from "./modules/simulation/simulation.routes";
import { schedulingRoutes }  from "./modules/scheduling/scheduling.routes"; // ← novo
import { errorHandler }      from "./middlewares/error.middleware";

const app = express();

// ── Middlewares ────────────────────────────────────────────────────────────────
app.use(cors({ origin: ["http://localhost:3000"], credentials: true }));
app.use(express.json());

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/consultants", consultantRoutes);
app.use("/api/projects",    projectRoutes);
app.use("/api/simulation",  simulationRoutes);
app.use("/api/scheduling",  schedulingRoutes); // ← novo

// ── Error handler (must be last) ──────────────────────────────────────────────
app.use(errorHandler);

export default app;