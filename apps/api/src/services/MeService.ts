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
