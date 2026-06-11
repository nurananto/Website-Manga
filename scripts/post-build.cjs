const fs = require('fs');
fs.copyFileSync('dist/index.html', 'dist/404.html');
console.log('post-build: 404.html created');
