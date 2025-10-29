const sharp = require('sharp');
const fs = require('fs');

async function detectTVZonesFromImage(imagePath) {
  try {
    const image = sharp(imagePath);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error('Unable to read image dimensions');
    }

    const imageWidth = metadata.width;
    const imageHeight = metadata.height;

    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

    console.log(`Image loaded: ${imageWidth}x${imageHeight}, channels: ${info.channels}`);

    // Detect red regions
    const rectangles = await detectRedRectangles(data, imageWidth, imageHeight, info.channels);

    console.log(`Found ${rectangles.length} rectangles`);

    // Convert to zones
    const zones = rectangles.map((rect, i) => {
      const x = (rect.x / imageWidth) * 100;
      const y = (rect.y / imageHeight) * 100;
      const width = (rect.width / imageWidth) * 100;
      const height = (rect.height / imageHeight) * 100;

      return {
        id: `tv${i + 1}`,
        outputNumber: i + 1,
        x: Math.round(x * 100) / 100,
        y: Math.round(y * 100) / 100,
        width: Math.round(width * 100) / 100,
        height: Math.round(height * 100) / 100,
        label: `TV ${String(i + 1).padStart(2, '0')}`,
        confidence: 0.85
      };
    });

    return {
      zones,
      imageWidth,
      imageHeight,
      detectionsCount: rectangles.length,
      errors: []
    };
  } catch (error) {
    console.error('Detection error:', error);
    return {
      zones: [],
      imageWidth: 0,
      imageHeight: 0,
      detectionsCount: 0,
      errors: [error.message]
    };
  }
}

async function detectRedRectangles(pixelData, width, height, channels) {
  const rectangles = [];
  const visited = new Set();

  const RED_THRESHOLD = { min: 180, max: 255 };
  const GREEN_THRESHOLD = { max: 150 };
  const BLUE_THRESHOLD = { max: 150 };

  const isRed = (r, g, b) => {
    return (
      r >= RED_THRESHOLD.min &&
      r <= RED_THRESHOLD.max &&
      g <= GREEN_THRESHOLD.max &&
      b <= BLUE_THRESHOLD.max &&
      r > g + 50 &&
      r > b + 50
    );
  };

  const getPixel = (x, y) => {
    const idx = (y * width + x) * channels;
    return {
      r: pixelData[idx],
      g: pixelData[idx + 1],
      b: pixelData[idx + 2]
    };
  };

  const floodFill = (startX, startY) => {
    const queue = [[startX, startY]];
    const pixels = [];
    let minX = startX, maxX = startX, minY = startY, maxY = startY;

    while (queue.length > 0) {
      const [x, y] = queue.shift();
      const key = `${x},${y}`;

      if (visited.has(key)) continue;
      if (x < 0 || x >= width || y < 0 || y >= height) continue;

      const pixel = getPixel(x, y);
      if (!isRed(pixel.r, pixel.g, pixel.b)) continue;

      visited.add(key);
      pixels.push([x, y]);

      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);

      queue.push([x + 1, y]);
      queue.push([x - 1, y]);
      queue.push([x, y + 1]);
      queue.push([x, y - 1]);
    }

    const rectWidth = maxX - minX + 1;
    const rectHeight = maxY - minY + 1;
    const MIN_SIZE = 5;

    if (rectWidth < MIN_SIZE || rectHeight < MIN_SIZE || pixels.length < 20) {
      return null;
    }

    return {
      x: minX,
      y: minY,
      width: rectWidth,
      height: rectHeight,
      pixels
    };
  };

  console.log('Scanning for red pixels...');

  for (let y = 0; y < height; y += 3) {
    for (let x = 0; x < width; x += 3) {
      const key = `${x},${y}`;
      if (visited.has(key)) continue;

      const pixel = getPixel(x, y);
      if (isRed(pixel.r, pixel.g, pixel.b)) {
        const rect = floodFill(x, y);
        if (rect) {
          rectangles.push(rect);
          console.log(`Found rectangle ${rectangles.length} at (${rect.x}, ${rect.y}) size ${rect.width}x${rect.height}`);
        }
      }
    }
  }

  console.log(`Total rectangles before merging: ${rectangles.length}`);

  // Merge nearby rectangles
  const merged = mergeNearbyRectangles(rectangles);

  console.log(`Total rectangles after merging: ${merged.length}`);

  return merged;
}

function mergeNearbyRectangles(rectangles) {
  if (rectangles.length === 0) return [];

  const sorted = [...rectangles].sort((a, b) => {
    const yDiff = a.y - b.y;
    if (Math.abs(yDiff) > 20) return yDiff;
    return a.x - b.x;
  });

  const merged = [];
  const used = new Set();

  for (let i = 0; i < sorted.length; i++) {
    if (used.has(i)) continue;

    let current = sorted[i];
    const toMerge = [i];

    for (let j = i + 1; j < sorted.length; j++) {
      if (used.has(j)) continue;

      const other = sorted[j];

      const centerX1 = current.x + current.width / 2;
      const centerY1 = current.y + current.height / 2;
      const centerX2 = other.x + other.width / 2;
      const centerY2 = other.y + other.height / 2;

      const distance = Math.sqrt(
        Math.pow(centerX2 - centerX1, 2) +
        Math.pow(centerY2 - centerY1, 2)
      );

      if (distance < 30) {
        toMerge.push(j);
        console.log(`Merging rectangle ${i} with ${j} (distance: ${distance.toFixed(1)})`);

        const minX = Math.min(current.x, other.x);
        const minY = Math.min(current.y, other.y);
        const maxX = Math.max(current.x + current.width, other.x + other.width);
        const maxY = Math.max(current.y + current.height, other.y + other.height);

        current = {
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY,
          pixels: [...current.pixels, ...other.pixels]
        };
      }
    }

    toMerge.forEach(idx => used.add(idx));
    merged.push(current);
  }

  return merged;
}

// Run test
detectTVZonesFromImage('/home/ubuntu/Sports-Bar-TV-Controller/tests/layout_import/Graystone Layout.png')
  .then(result => {
    console.log('\n=== DETECTION RESULTS ===');
    console.log('Zones detected:', result.zones.length);
    console.log('Image size:', result.imageWidth, 'x', result.imageHeight);
    console.log('Errors:', result.errors);

    if (result.zones.length > 0) {
      console.log('\nFirst 10 zones:');
      result.zones.slice(0, 10).forEach(z => {
        console.log(`  ${z.label}: (${z.x}%, ${z.y}%) size ${z.width}%x${z.height}%`);
      });
    }

    process.exit(0);
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
