import {tip} from './engine.mjs';

// Forecast the same discrete 18-unit probe steps and ore ordering as the host.
// Pure presentation: it never advances the session or chooses an input for the player.
export function scan(g) {
  for (let length = 54; length <= 954; length += 18) {
    const point = tip({...g, length: Math.min(length, 950)});
    const ore = g.ores.find(o => !o.taken && (point[0]-o.x)**2 + (point[1]-o.y)**2 <= (o.radius+8)**2);
    if (ore) return {ore, point, value: ore.kind === 2 ? Math.trunc(ore.value*(100+20*g.lens)/100) : ore.value};
    if (point[0]<25 || point[0]>975 || point[1]>=650 || length>=950) return {ore:null,point};
  }
}
