import { Request, Response, NextFunction } from "express";
import { schedulingService } from "./scheduling.service";

export const schedulingController = {
  /** POST /api/scheduling — score, order, and suggest dates for hot/cold projects */
  async schedule(req: Request, res: Response, next: NextFunction) {
    try {
      const { projectIds } = req.body;

      if (!Array.isArray(projectIds) || !projectIds.length) {
        res.status(400).json({ error: "projectIds deve ser um array não vazio" });
        return;
      }

      const result = await schedulingService.schedule(projectIds);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
};