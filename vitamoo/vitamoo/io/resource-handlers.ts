// Pluggable parsers for IFF resource payloads (by FourCC). Register handlers on a
// ResourceHandlerRegistry and run parseOrNull for unknown types.

import type { MaxisIff1Resource } from './iff-maxis.js';

export interface ResourceParseContext {
    /** Full IFF file (caller may slice per resource). */
    fileBuffer: ArrayBuffer;
    /** Resource metadata from listMaxisIff1Resources. */
    resource: MaxisIff1Resource;
    /** Payload only (same as slice from getMaxisIff1ResourceData). */
    data: ArrayBuffer;
}

export interface ResourceHandler<T = unknown> {
    /** Four-character type (e.g. STR#, BHAV). */
    readonly typeFourCC: string;
    parse(ctx: ResourceParseContext): T;
}

export class ResourceHandlerRegistry {
    private readonly map = new Map<string, ResourceHandler>();

    register(handler: ResourceHandler): void {
        this.map.set(handler.typeFourCC, handler);
    }

    unregister(typeFourCC: string): void {
        this.map.delete(typeFourCC);
    }

    get(typeFourCC: string): ResourceHandler | undefined {
        return this.map.get(typeFourCC);
    }

    /** Returns handler output, or `null` if no handler is registered for this FourCC. */
    parseOrNull(ctx: ResourceParseContext): unknown | null {
        const h = this.map.get(ctx.resource.header.typeFourCC);
        return h ? h.parse(ctx) : null;
    }

    registeredTypes(): string[] {
        return [...this.map.keys()].sort();
    }
}
