import { Router } from "express";
import { simulationController } from "./simulation.controller";

export const simulationRoutes = Router();

// POST /api/simulation/:projectId — runs the allocation solver for a project
simulationRoutes.post("/:projectId", simulationController.simulate);
