import Timezones from '../assets/timezones.json';

export function getDefaultTimezone(): string {
    const currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (currentTimezone) {
        const matchingTimezone = Timezones.find((timezone) =>
            timezone.utc.includes(currentTimezone)
        );

        if (matchingTimezone) {
            return matchingTimezone.utc[0];
        }
    }
    return '';
}
