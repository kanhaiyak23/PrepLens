import type { CompanySummary } from "@preplens/shared";
import type { CompanyReader } from "../domain/ports.js";

export class CompanyService {
  constructor(private readonly reader: CompanyReader) {}
  list(q: { prefix?: string; limit: number }): Promise<CompanySummary[]> { return this.reader.list(q); }
}
