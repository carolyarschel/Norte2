import { Router } from "express";
import { schedulingController } from "./scheduling.controller";

export const schedulingRoutes = Router();

/** POST /api/scheduling */
schedulingRoutes.post("/", schedulingController.schedule);