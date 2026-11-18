/**
 * services/MeService.ts — MY PROFILE
 *
 * What it does: read my profile (name, batch, branch, role) and update my batch or branch.
 * The login middleware also uses getMe() on every request to find out the user's current role.
 *
 * System design:
 * - Separate reader and writer interfaces (Interface Segregation / CQRS-style split of reads and writes).
 * - Fail fast: an empty update is refused before calling the database.
 * - The user is always the one from the login token; there is no "user id" parameter that could be changed.
 */
import type { MeResponse, ProfileUpdateDto } from "@preplens/shared";
import type { ProfileReader, ProfileWriter } from "../domain/ports.js";
import { NotFoundError, ValidationError } from "../domain/errors.js";

export class MeService {
  constructor(private readonly reader: ProfileReader, private readonly writer: ProfileWriter) {}

  async getMe(): Promise<MeResponse> {
    const me = await this.reader.getMe();
    if (!me) throw new NotFoundError("Profile not found.");
    return me;
  }

  async update(dto: ProfileUpdateDto): Promise<MeResponse> {
    if (Object.keys(dto).length === 0) throw new ValidationError("Nothing to update.", { body: "empty" });
    return this.writer.update(dto);
  }
}
