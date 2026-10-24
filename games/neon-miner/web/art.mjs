// Original imagegen assets, decoded once and reused by Canvas and the in-game store.
export const oreArt = ['gold', 'heavy-gold', 'crystal', 'scrap', 'power-cell', 'cache'];
export const scenes = ['undercity', 'foundry', 'vault', 'reactor'];
export const artNames = [...scenes, ...oreArt, 'drone', 'claw', 'emp', 'overdrive', 'time-cell', 'lens'];
export const artUrl = name => new URL(`./art/${name}.webp`, import.meta.url).href;
export async function loadArt() {
  const entries = await Promise.all(artNames.map(async name => {
    const image = new Image();
    image.decoding = 'async';
    image.src = artUrl(name);
    await image.decode();
    return [name, image];
  }));
  return Object.fromEntries(entries);
}
