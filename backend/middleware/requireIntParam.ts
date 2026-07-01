import type { RequestHandler } from 'express';

/**
 * Route-param guard: reject non-positive-integer values for params that map to
 * integer (serial) DB columns. Without it, a value like "abc" reaches Postgres
 * and triggers `invalid input syntax for integer` → a 500. With it, the caller
 * gets a clean 400 and the query is never run.
 *
 * Mount ONLY on params backed by integer columns. Do NOT use on string-token
 * params such as pets `/public/:petId` (queries text column pet_id) or
 * `/:filename`. Pass one or more param names.
 *
 * @example router.get("/:id", requireIntParam("id"), handler)
 * @example router.put("/:id/vaccinations/:recordId", requireIntParam("id", "recordId"), handler)
 */
function requireIntParam(...names: string[]): RequestHandler {
  return (req, res, next) => {
    for (const name of names) {
      const raw = req.params[name];
      // Accept only a run of digits that parses to a positive INT4. Upper bound
      // is Postgres INT4 max (2147483647): every id column is SERIAL, so a larger
      // value would throw `integer out of range` (500) instead of a clean 400.
      // Rejects "1.5", "-1", "1abc", "", undefined, and oversized values.
      if (
        typeof raw !== 'string' ||
        !/^\d+$/.test(raw) ||
        Number(raw) < 1 ||
        Number(raw) > 2147483647
      ) {
        return res.status(400).json({ error: `Invalid ${name}` });
      }
    }
    next();
  };
}

export = requireIntParam;
