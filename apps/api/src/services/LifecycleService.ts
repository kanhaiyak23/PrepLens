import type { VisibilityResult } from "@preplens/shared";
import type { ExperienceWriter } from "../domain/ports.js";

/** The author's own controls: withdraw is instant and unconditional; coming back goes through review again. */
export class LifecycleService {
  constructor(private readonly writer: ExperienceWriter) {}
  async unpublish(id: string): Promise<VisibilityResult> { return { status: await this.writer.setVisibility(id, false) }; }
  async republish(id: string): Promise<VisibilityResult> { return { status: await this.writer.setVisibility(id, true) }; }
}
