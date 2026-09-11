const compact = new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1,
});

/** US dollars, to the cent — and never "$0.00" for something that cost money. */
export const formatCost = (dollars: number): string =>
    dollars > 0 && dollars < 0.01 ? '< $0.01' : `$${dollars.toFixed(2)}`;

/** 1.2M rather than 1,234,567: the order of magnitude is what matters here. */
export const formatTokens = (tokens: number): string => compact.format(tokens);
