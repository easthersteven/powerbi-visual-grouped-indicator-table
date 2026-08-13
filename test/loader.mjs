// Node ESM loader used by the test runner:
//  - stubs .less imports (styles are irrelevant under Node)
//  - resolves extensionless relative imports emitted by tsc (e.g. "./logic" -> "./logic.js")
export async function resolve(specifier, context, next) {
    if (specifier.endsWith(".less")) {
        return { url: new URL(specifier, context.parentURL).href, shortCircuit: true };
    }
    try {
        return await next(specifier, context);
    } catch (err) {
        if (specifier.startsWith(".") && !/\.[a-z0-9]+$/i.test(specifier)) {
            return next(specifier + ".js", context);
        }
        throw err;
    }
}

export function load(url, context, next) {
    if (url.endsWith(".less")) {
        return { format: "module", source: "export default {};", shortCircuit: true };
    }
    return next(url, context);
}
