// One isotropic transform is shared by drawing and pointer input. Full canvas;
// fixed-rule arenas keep their geometry while the environment fills the display.
export function viewport(width,height,kind,coarse=false){
 const prism=kind==='prism-breaker',sling=kind==='sling',logicalWidth=sling?1100:1000,logicalHeight=prism?625:sling?560:1000;
 const ui=Math.max(1,Math.min(2,height/1080));
 const top=prism?(width<600?135:height<500?70:0):sling?(height<500?56:96*ui):100*ui;
 const bottom=prism?(width<600?100:height<500?45:0):sling?(height<500?66:116*ui):coarse?110:35*ui;
 const scale=Math.max(.05,Math.min((width- (prism?0:24))/logicalWidth,Math.max(80,height-top-bottom)/logicalHeight));
 return {width,height,scale,x:(width-logicalWidth*scale)/2,y:top+(height-top-bottom-logicalHeight*scale)/2,logicalWidth,logicalHeight};
}
export function backingRatio(width,height,ratio){return Math.min(ratio,Math.sqrt(8294400/Math.max(1,width*height)));}
export function pointerInViewport(clientX,clientY,rect,kind,coarse=false){const v=viewport(rect.width,rect.height,kind,coarse);return{x:(clientX-rect.left-v.x)/v.scale,y:(clientY-rect.top-v.y)/v.scale};}
