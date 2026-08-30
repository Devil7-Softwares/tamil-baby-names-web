const shared = new URL('./vendor/shared/dist/index.js', import.meta.url).href;

export function resolve(specifier, context, nextResolve) {
    if (specifier === '@tbn/shared') {
        return { url: shared, shortCircuit: true };
    }

    return nextResolve(specifier, context);
}
