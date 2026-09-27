const fs = require('fs');
const file = 'd:\\Smars\\Smars\\Ananta\\supabase\\apps\\studio\\pages\\admin\\index.tsx';
let content = fs.readFileSync(file, 'utf8');

// Find orphaned fragment: starts after the closing brace of AdminPage
// The orphan starts with a blank line then "    const body = parts[1]"
const orphanMarker = 'const body = parts[1]';
const orphanIdx = content.indexOf(orphanMarker);
if (orphanIdx > 0) {
  // Back up to find the preceding newline/blank line
  let cutAt = orphanIdx;
  // Go back to find where the orphan block starts (before any blank lines)
  while (cutAt > 0 && (content[cutAt-1] === '\n' || content[cutAt-1] === '\r' || content[cutAt-1] === ' ')) {
    cutAt--;
  }
  // cutAt is now at the closing } of AdminPage — include it
  const clean = content.substring(0, cutAt + 1).trimEnd();
  fs.writeFileSync(file, clean + '\n', { encoding: 'utf8' });
  const lines = fs.readFileSync(file, 'utf8').split('\n').length;
  console.log('Done. Lines:', lines);
  console.log('Last 5 lines:');
  console.log(clean.split('\n').slice(-5).join('\n'));
} else {
  console.log('No orphan found. Last 10 lines:');
  console.log(content.split('\n').slice(-10).join('\n'));
}
