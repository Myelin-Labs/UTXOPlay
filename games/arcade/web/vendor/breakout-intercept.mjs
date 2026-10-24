// Adapted from Jake Gordon's javascript-breakout / game.js, Game.Math.intercept.
// Revision eed59e2affa9423b93d2ac8ff93061bb88b33284. MIT; see jake-gordon-MIT.txt.
// Used for the optional visual guide, never the authoritative game executor.
export function intercept(x1,y1,x2,y2,x3,y3,x4,y4,d){
 const denom=((y4-y3)*(x2-x1))-((x4-x3)*(y2-y1));
 if(denom!==0){
  const ua=(((x4-x3)*(y1-y3))-((y4-y3)*(x1-x3)))/denom;
  if(ua>=0&&ua<=1){
   const ub=(((x2-x1)*(y1-y3))-((y2-y1)*(x1-x3)))/denom;
   if(ub>=0&&ub<=1)return {x:x1+ua*(x2-x1),y:y1+ua*(y2-y1),d};
  }
 }
 return null;
}
