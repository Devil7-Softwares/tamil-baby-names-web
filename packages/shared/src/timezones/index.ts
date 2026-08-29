import data from './timezones.json';

export interface Timezone {
    value: string;
    abbr: string;
    offset: number;
    isdst: boolean;
    text: string;
    utc: string[];
}

// Annotated rather than inferred, so the declaration carries the shape of one
// entry instead of the literal type of all 107.
export const timezones: Timezone[] = data;

export function getDefaultTimezone(): string {
    const currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (currentTimezone) {
        const matchingTimezone = timezones.find((timezone) =>
            timezone.utc.includes(currentTimezone),
        );

        if (matchingTimezone) {
            return matchingTimezone.utc[0];
        }
    }
    return '';
}
