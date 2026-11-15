export class CompanyService {
    reader;
    constructor(reader) {
        this.reader = reader;
    }
    list(q) { return this.reader.list(q); }
}
