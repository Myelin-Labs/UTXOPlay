import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
// Rounded boxes are non-indexed; cylinders and spheres are indexed. Normalize
// before batching so every authored prop can share one material draw call.
export function mergeParts(parts){
 const normalized=parts.map(part=>part.index?part.toNonIndexed():part);
 const merged=mergeGeometries(normalized);
 normalized.forEach((part,index)=>{if(part!==parts[index])part.dispose();});
 if(!merged)throw Error('Incompatible OpenStrike model geometry');return merged;
}
