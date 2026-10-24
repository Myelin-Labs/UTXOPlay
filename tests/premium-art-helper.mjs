// Optional native Canvas integration helper; uses the same URLs as the browser loader.
import {createRequire} from 'node:module';import {resolve} from 'node:path';
import {artUrl} from '../games/arcade/web/premium-art.mjs';
const require=createRequire(resolve(process.env.ARCADE_TEST_MODULES,'../package.json')),{loadImage}=require('@napi-rs/canvas');
export const loadTestArt=async kind=>Object.fromEntries(await Promise.all(['bg','atlas'].map(async name=>[name,await loadImage('games/arcade/web'+artUrl(kind,name).split('?')[0].replace('/arcade',''))])));
