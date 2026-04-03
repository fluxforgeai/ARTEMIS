import type { VercelRequest, VercelResponse } from '@vercel/node';
import { inflateRawSync } from 'zlib';

const OEM_ZIP_URL = 'https://www.nasa.gov/wp-content/uploads/2026/03/artemis-ii-oem-2026-04-02-to-ei-v3.zip';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (_req.method === 'OPTIONS') return res.status(204).end();

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');

  try {
    // Fetch the ZIP file from NASA
    const upstream = await fetch(OEM_ZIP_URL);
    if (!upstream.ok) throw new Error(`Upstream ${upstream.status}`);

    const arrayBuffer = await upstream.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const text = extractFirstFileFromZip(bytes);
    if (text === null) {
      throw new Error('ZIP extraction failed: unsupported archive format');
    }
    if (!text.includes('META_START') && !text.includes('CCSDS_OEM_VERS')) {
      throw new Error('ZIP extracted but content is not valid OEM data');
    }

    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send(text);
  } catch (err) {
    console.error('OEM fetch failed:', err);
    res.status(502).json({ error: 'Failed to fetch OEM data. Use /fallback-oem.asc' });
  }
}

function extractFirstFileFromZip(bytes: Uint8Array): string | null {
  // Check ZIP magic number
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4B || bytes[2] !== 0x03 || bytes[3] !== 0x04) {
    return null;
  }

  const flags = bytes[6] | (bytes[7] << 8);
  const compressionMethod = bytes[8] | (bytes[9] << 8);
  let compressedSize = bytes[18] | (bytes[19] << 8) | (bytes[20] << 16) | (bytes[21] << 24);
  const filenameLen = bytes[26] | (bytes[27] << 8);
  const extraLen = bytes[28] | (bytes[29] << 8);
  const dataOffset = 30 + filenameLen + extraLen;

  // Data descriptor flag (bit 3): sizes in local header are 0,
  // read from central directory instead
  if (compressedSize === 0 && (flags & 0x08)) {
    compressedSize = readSizeFromCentralDirectory(bytes);
    if (compressedSize <= 0) return null;
  }

  if (compressionMethod === 0) {
    // Stored (no compression)
    return new TextDecoder().decode(bytes.slice(dataOffset, dataOffset + compressedSize));
  } else if (compressionMethod === 8) {
    // Deflate
    try {
      const decompressed = inflateRawSync(Buffer.from(bytes.slice(dataOffset, dataOffset + compressedSize)));
      return decompressed.toString('utf-8');
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Read compressedSize from the central directory when local header uses data descriptors.
 * Finds the End of Central Directory record, then reads the first central directory entry.
 */
function readSizeFromCentralDirectory(bytes: Uint8Array): number {
  // Find End of Central Directory (scan backward for PK\x05\x06)
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4B && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) {
      const cdOffset = bytes[i + 16] | (bytes[i + 17] << 8) | (bytes[i + 18] << 16) | (bytes[i + 19] << 24);
      // Verify central directory entry signature PK\x01\x02
      if (bytes[cdOffset] === 0x50 && bytes[cdOffset + 1] === 0x4B &&
          bytes[cdOffset + 2] === 0x01 && bytes[cdOffset + 3] === 0x02) {
        return bytes[cdOffset + 20] | (bytes[cdOffset + 21] << 8) |
               (bytes[cdOffset + 22] << 16) | (bytes[cdOffset + 23] << 24);
      }
    }
  }
  return -1;
}
