import { z } from "zod";
import type { Context, MiddlewareHandler } from "hono";

declare module "hono" {
  interface ContextVariableMap {
    validatedBody: unknown;
  }
}

export const validateBody =
  <T>(schema: z.ZodType<T>): MiddlewareHandler =>
  async (c, next) => {
    try {
      const body = await c.req.json();
      const parsed = schema.parse(body);
      c.set("validatedBody", parsed);
      await next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json(
          {
            success: false,
            error: "Validation failed",
            details: error.issues,
          },
          400
        );
      }
      return c.json({ success: false, error: "Invalid JSON body" }, 400);
    }
  };
