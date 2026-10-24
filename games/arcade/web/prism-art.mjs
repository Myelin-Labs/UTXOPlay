import {loadArtwork,artUrl} from './premium-art.mjs';
export const prismNames=['bg','atlas'];
export const prismArtUrl=name=>artUrl('prism-breaker',name);
export const loadPrismArt=cover=>loadArtwork('prism-breaker',cover);
