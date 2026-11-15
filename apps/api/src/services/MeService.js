import { NotFoundError, ValidationError } from "../domain/errors.js";
export class MeService {
    reader;
    writer;
    constructor(reader, writer) {
        this.reader = reader;
        this.writer = writer;
    }
    async getMe() {
        const me = await this.reader.getMe();
        if (!me)
            throw new NotFoundError("Profile not found.");
        return me;
    }
    async update(dto) {
        if (Object.keys(dto).length === 0)
            throw new ValidationError("Nothing to update.", { body: "empty" });
        return this.writer.update(dto);
    }
}
