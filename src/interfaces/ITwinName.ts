import { Gender } from '../types';

export interface ITwinName {
    id: number;
    language: string;
    gender: Gender;
    name1: string;
    meaning1: string;
    name2: string;
    meaning2: string;
}
