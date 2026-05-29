import { Router } from "express";
import { z } from "zod";
import { simulationController } from "./simulation.controller";
import { validate } from "../../middlewares/validate.middleware";

const batchSchema = z.object({
  projectIds: z.array(z.number().int().positive()).min(1).max(10),
  randomize:  z.boolean().optional().default(false),
});

export const simulationRoutes = Router();

// POST /api/simulation — batch simulate 1+ projects together
simulationRoutes.post("/", validate(batchSchema), simulationController.simulate);
