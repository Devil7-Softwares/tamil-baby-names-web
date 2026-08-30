import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // A 401 or a validation error will not fix itself on a retry, and
            // retrying only delays the redirect to the login page.
            retry: false,
            refetchOnWindowFocus: false,
        },
    },
});
