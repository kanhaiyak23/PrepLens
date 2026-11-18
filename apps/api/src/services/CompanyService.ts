/**
 * services/CompanyService.ts — THE COMPANY LIST
 *
 * What it does: returns companies, optionally only those starting with what the user typed ("prefix"),
 * for the search box and filters.
 *
 * System design: Dependency Inversion — it uses the CompanyReader interface, so the data could come from
 * Supabase in production or a fake list in tests.
 */
import type { CompanySummary } from "@preplens/shared";
import type { CompanyReader } from "../domain/ports.js";

export class CompanyService {
  constructor(private readonly reader: CompanyReader) {}
  list(q: { prefix?: string; limit: number }): Promise<CompanySummary[]> { return this.reader.list(q); }
}
