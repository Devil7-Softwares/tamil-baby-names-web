import { Gender } from '../types/index.js';

export interface ITwinName {
    id: number;
    language: string;
    gender: Gender;
    name1: string;
    meaning1: string;
    name2: string;
    meaning2: string;
    /** Null when the chosen method gives the name no value. */
    nameNumber1?: number | null;
    nameNumber2?: number | null;
}
