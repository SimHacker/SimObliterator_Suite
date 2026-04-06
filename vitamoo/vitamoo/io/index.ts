// Sims 1 container I/O: FAR archives and Maxis IFF 1.0 resources, plus a handler registry
// for typed resource payloads. Aligns with Code/CTGLib (FAR) and Code/msrc/File/IFFResFile.cpp.

export {
    MAXIS_IFF1_HEADER,
    MAXIS_IFF_FLAG_INVALID,
    MAXIS_IFF_FLAG_INTERNAL,
    MAXIS_IFF_FLAG_LITTLE_ENDIAN,
    isMaxisIff1,
    readMaxisIff1BlockHeader,
    listMaxisIff1Resources,
    getMaxisIff1ResourceData,
} from './iff-maxis.js';
export type { MaxisIff1BlockHeader, MaxisIff1Resource } from './iff-maxis.js';

export {
    FAR_MAGIC,
    FAR_VERSION,
    isFar,
    parseFar,
    extractFarEntry,
} from './far.js';
export type { FarArchive, FarEntry } from './far.js';

export {
    ResourceHandlerRegistry,
} from './resource-handlers.js';
export type { ResourceHandler, ResourceParseContext } from './resource-handlers.js';
