// Perspective segment construction adapted from Jake Gordon's javascript-racer
// common.js Render.segment at 3e8a060b5900755db27f899612a74a77427c853e (MIT).
// See licenses/javascript-racer.txt.
// Projection remains UTXOPlay's roadPoint: artwork cannot change collisions.
export function roadSegment(c,y1,w1,y2,w2,{road,edge,lane},lanes=3){
 const quad=(a,b,d,e,f,g,h,i,color)=>{c.fillStyle=color;c.beginPath();c.moveTo(a,b);c.lineTo(d,e);c.lineTo(f,g);c.lineTo(h,i);c.closePath();c.fill();};
 const rumble1=w1/Math.max(6,2*lanes),rumble2=w2/Math.max(6,2*lanes),mark1=w1/Math.max(90,24*lanes),mark2=w2/Math.max(90,24*lanes);
 quad(500-w1-rumble1,y1,500-w1,y1,500-w2,y2,500-w2-rumble2,y2,edge);
 quad(500+w1,y1,500+w1+rumble1,y1,500+w2+rumble2,y2,500+w2,y2,edge);
 quad(500-w1,y1,500+w1,y1,500+w2,y2,500-w2,y2,road);
 if(lane)for(let n=1;n<lanes;n++){const x1=500-w1+n*w1*2/lanes,x2=500-w2+n*w2*2/lanes;quad(x1-mark1,y1,x1+mark1,y1,x2+mark2,y2,x2-mark2,y2,lane);}
}
