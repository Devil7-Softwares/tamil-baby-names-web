import { Numerology } from '../types/index.js';

/** Name numbers by method. A method that cannot value the name is absent. */
export type NameNumerology = Partial<Record<Numerology, number>>;

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
