const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../sbf-main/src/pages/AdminSettingsPage.tsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('activeTab === "sections"') || line.includes("activeTab === 'sections'")) {
    console.log(`Line ${idx + 1}: ${line}`);
  }
});
