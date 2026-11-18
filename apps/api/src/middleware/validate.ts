/**
 * middleware/validate.ts — CHECKS THE INPUT BEFORE ANY CODE USES IT
 *
 * What it does: checks the URL parts (params), the ?query and the JSON body against Zod schemas.
 * If anything is wrong -> 400 with a list of which fields are wrong. If all is fine, the clean data is put on req.valid.
 *
 * System design:
 * - Validation at the boundary (ADR-16): everything from outside is untrusted. It is checked once, at the door,
 *   so controllers and services can trust their input.
 * - "Parse, don't validate": the schema doesn't just say yes/no, it returns CLEANED data — text trimmed, defaults
 *   filled in, numbers converted, and unknown fields removed (so nobody can sneak in e.g. role: "admin").
 * - Shared schemas: the same Zod rules (in packages/shared) are used by the website forms, so both sides agree.
 */
import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { ValidationError } from "../domain/errors.js";

type Schemas = { params?: ZodType; query?: ZodType; body?: ZodType };

export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const valid: Request["valid"] = {};
    const fields: Record<string, string> = {}; // collects ALL problems, so the user can fix them in one go
    for (const part of ["params", "query", "body"] as const) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(part === "body" ? (req.body ?? {}) : req[part]);
      if (result.success) valid[part] = result.data;
      else for (const issue of result.error.issues) fields[issue.path.join(".") || part] = issue.message;
    }
    if (Object.keys(fields).length) return next(new ValidationError("Some fields are not valid.", fields));
    req.valid = valid; // controllers read the cleaned input from here, never from req.body directly
    next();
  };
}
