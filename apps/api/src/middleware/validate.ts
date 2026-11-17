import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { ValidationError } from "../domain/errors.js";

type Schemas = { params?: ZodType; query?: ZodType; body?: ZodType };

/** Parse, don't validate (ADR-16): handlers receive typed, trimmed, defaulted data and unknown keys are gone. */
export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const valid: Request["valid"] = {};
    const fields: Record<string, string> = {};
    for (const part of ["params", "query", "body"] as const) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(part === "body" ? (req.body ?? {}) : req[part]);
      if (result.success) valid[part] = result.data;
      else for (const issue of result.error.issues) fields[issue.path.join(".") || part] = issue.message;
    }
    if (Object.keys(fields).length) return next(new ValidationError("Some fields are not valid.", fields));
    req.valid = valid;
    next();
  };
}
