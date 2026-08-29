export interface IName {
    id: number;
    gender: string;
    religion: string;
    firstLetter: string;
    language: string;
    name: string;
    meaning: string;
    /** Null when the chosen method gives the name no value. */
    nameNumber?: number | null;
}
