const { createCanvas, loadImage } = require('canvas');
loadImage('public/skins/default/gen.bmp').then(img => {
    console.log(`Image size: ${img.width}x${img.height}`);
}).catch(console.error);
