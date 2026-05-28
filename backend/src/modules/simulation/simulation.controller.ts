import { Request, Response, NextFunction } from "express";
import { simulationService } from "./simulation.service";

export const simulationController = {
  async simulate(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await simulationService.simulate(Number(req.params.projectId));
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
};
