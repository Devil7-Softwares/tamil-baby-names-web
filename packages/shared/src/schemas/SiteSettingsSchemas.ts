import { z } from 'zod';

/** Switches for the public site, flipped from the admin dashboard. */
export const SiteSettingsSchema = z.object({
    /** Serve candidate names beside the published ones. */
    showUnreviewed: z.boolean(),
});

export type SiteSettings = z.infer<typeof SiteSettingsSchema>;
