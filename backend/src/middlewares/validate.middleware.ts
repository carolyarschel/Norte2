import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

/** Validates req.body against a Zod schema. */
export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next({
          statusCode: 422,
          message: "Dados inválidos",
          details: err.flatten().fieldErrors,
          name: "AppError",
        } as any);
        return;
      }
      next(err);
    }
  };
}
