// This is a utility script to generate PWA icons
// Run with: npx tsx src/utils/generate-icons.ts

const generateIcon = (size: number): string => {
  const svg = `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="#000000"/>
  <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.35}" fill="#1DB954"/>
  <path d="M${size * 0.35} ${size * 0.45} Q${size * 0.5} ${size * 0.3} ${size * 0.65} ${size * 0.45}" stroke="white" stroke-width="${size * 0.06}" fill="none"/>
  <path d="M${size * 0.3} ${size * 0.55} Q${size * 0.5} ${size * 0.4} ${size * 0.7} ${size * 0.55}" stroke="white" stroke-width="${size * 0.06}" fill="none"/>
  <path d="M${size * 0.25} ${size * 0.65} Q${size * 0.5} ${size * 0.5} ${size * 0.75} ${size * 0.65}" stroke="white" stroke-width="${size * 0.06}" fill="none"/>
</svg>`;
  
  return svg;
};

// Log the SVG content for manual creation
console.log('Create icon-192.png with this SVG:');
console.log(generateIcon(192));
console.log('\nCreate icon-512.png with this SVG:');
console.log(generateIcon(512));
console.log('\nUse an online SVG to PNG converter or design tool to create the PNG files.');

export {};