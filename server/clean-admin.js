const fs = require('fs');
const file = 'd:\\Smars\\Smars\\Ananta\\supabase\\apps\\studio\\pages\\admin\\index.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace all corrupted utf-8 characters with standard ascii
// The long string of A... is just replacing it with a simple divider or stripping it.
content = content.replace(/A.*?sA/g, '-');
content = content.replace(/AAA,AA,A\?/g, '-');
content = content.replace(/AAA,\A\?A\?sA/g, '-');
content = content.replace(/Ã¢â‚¬â€ /g, '-');
content = content.replace(/Ã¢â‚¬Â¦/g, '...');
content = content.replace(/Ã¢â€žÂ¢/g, '');
content = content.replace(/Ã‚Â/g, ' ');
content = content.replace(/[^\x00-\x7F]/g, ''); // strip all remaining non-ascii just in case

// Fix full width: change max-w-7xl to w-full or something
content = content.replace(/max-w-7xl mx-auto/g, 'w-full');

fs.writeFileSync(file, content, 'utf8');
console.log('Cleaned admin/index.tsx');
