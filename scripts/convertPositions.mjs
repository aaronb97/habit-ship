#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const POSITION_SOURCES_DIR = path.join(
  __dirname,
  '..',
  'src',
  'positionSources',
);

const POSITIONS_DIR = path.join(__dirname, '..', 'src', 'positions');

function extractTargetBodyName(textContent) {
  // Extract target body name from "Target body name: Mercury (199)" -> "Mercury"
  const lines = textContent.split('\n');
  for (const line of lines) {
    if (line.includes('Target body name:')) {
      // Match the name before the parentheses
      const match = line.match(/Target body name:\s*([^(]+)/);
      if (match) {
        return match[1].trim();
      }
    }
  }

  return null;
}

function parseDate(dateString) {
  // Parse "A.D. 2025-Oct-08 00:00:00.0000" to "2025-10-08"
  const match = dateString.match(/A\.D\.\s+(\d{4})-(\w{3})-(\d{2})/);
  if (!match) return null;

  const [, year, monthName, day] = match;
  const months = {
    Jan: '01',
    Feb: '02',
    Mar: '03',
    Apr: '04',
    May: '05',
    Jun: '06',
    Jul: '07',
    Aug: '08',
    Sep: '09',
    Oct: '10',
    Nov: '11',
    Dec: '12',
  };

  const month = months[monthName];
  return `${year}-${month}-${day}`;
}

function convertTextToJson(textContent) {
  const lines = textContent.split('\n');
  const positions = {};

  let inDataSection = false;

  for (const line of lines) {
    // Check for start of data section
    if (line.includes('$$SOE')) {
      inDataSection = true;
      continue;
    }

    // Check for end of data section
    if (line.includes('$$EOE')) {
      inDataSection = false;
      break;
    }

    // Parse data lines
    if (inDataSection && line.trim()) {
      // Split by comma and trim whitespace
      const parts = line.split(',').map((p) => p.trim());

      if (parts.length >= 5) {
        const dateString = parts[1]; // Calendar Date
        const x = parseFloat(parts[2]); // X position
        const y = parseFloat(parts[3]); // Y position
        const z = parseFloat(parts[4]); // Z position

        const date = parseDate(dateString);

        if (date && !isNaN(x) && !isNaN(y) && !isNaN(z)) {
          positions[date] = [Math.round(x), Math.round(y), Math.round(z)];
        }
      }
    }
  }

  return positions;
}

function processFile(filename) {
  const sourcePath = path.join(POSITION_SOURCES_DIR, filename);

  // Read the text file
  const textContent = fs.readFileSync(sourcePath, 'utf8');

  // Extract target body name from file content
  const targetBodyName = extractTargetBodyName(textContent);
  if (!targetBodyName) {
    console.log(`✗ Could not extract target body name from ${filename}`);
    return;
  }

  // Convert to JSON format
  const positions = convertTextToJson(textContent);

  // Determine output filename using extracted name (e.g., "Mercury" -> mercury.json)
  const baseName = targetBodyName.toLowerCase();
  const outputPath = path.join(POSITIONS_DIR, `${baseName}.json`);

  // Write JSON file
  fs.writeFileSync(outputPath, `${JSON.stringify(positions, null, 2)}\n`);

  console.log(
    `✓ Converted ${filename} (${targetBodyName}) -> ${baseName}.json (${
      Object.keys(positions).length
    } entries)`,
  );
}

function main() {
  console.log('Converting position data from text to JSON...\n');

  // Ensure positions directory exists
  if (!fs.existsSync(POSITIONS_DIR)) {
    fs.mkdirSync(POSITIONS_DIR, { recursive: true });
  }

  // Read all files in positionSources directory
  const files = fs.readdirSync(POSITION_SOURCES_DIR);
  const textFiles = files.filter((f) => f.endsWith('.txt'));

  if (textFiles.length === 0) {
    console.log('No text files found in positionSources directory.');
    return;
  }

  // Process each text file
  textFiles.forEach(processFile);

  console.log(`\nDone! Converted ${textFiles.length} file(s).`);
}

main();
