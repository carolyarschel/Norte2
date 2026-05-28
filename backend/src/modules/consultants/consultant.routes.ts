import { Router } from "express";
import { z } from "zod";
import { consultantController } from "./consultant.controller";
import { validate } from "../../middlewares/validate.middleware";

const createSchema = z.object({
  name:         z.string().min(2).max(200),
  level:        z.enum(["junior", "pleno", "senior"]),
  isLeader:     z.boolean().default(false),
  maxDays:      z.number().int().min(1).max(5).default(5),
  restrictions: z.array(z.number().int().min(1).max(5)).default([]),
});

const updateSchema = createSchema.partial();

export const consultantRoutes = Router();

consultantRoutes.get("/",          consultantController.list);
consultantRoutes.get("/:id",       consultantController.getById);
consultantRoutes.get("/:id/busy",  consultantController.busyDays);
consultantRoutes.post("/",         validate(createSchema), consultantController.create);
consultantRoutes.put("/:id",       validate(updateSchema), consultantController.update);
consultantRoutes.delete("/:id",    consultantController.remove);
