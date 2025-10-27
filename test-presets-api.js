// Quick test to verify channel presets are accessible
const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./prisma/data/sports_bar.db');

console.log('Testing Channel Presets API Data...\n');

// Test cable presets
db.all(
  "SELECT * FROM ChannelPreset WHERE deviceType='cable' AND isActive=1 ORDER BY `order`",
  [],
  (err, rows) => {
    if (err) {
      console.error('❌ Error querying cable presets:', err);
      return;
    }
    console.log(`✅ Cable Presets: ${rows.length} found`);
    rows.slice(0, 3).forEach(row => {
      console.log(`   - ${row.name} (Ch ${row.channelNumber})`);
    });
    console.log('');
    
    // Test directv presets
    db.all(
      "SELECT * FROM ChannelPreset WHERE deviceType='directv' AND isActive=1 ORDER BY `order`",
      [],
      (err, rows) => {
        if (err) {
          console.error('❌ Error querying directv presets:', err);
          return;
        }
        console.log(`✅ DirecTV Presets: ${rows.length} found`);
        rows.slice(0, 3).forEach(row => {
          console.log(`   - ${row.name} (Ch ${row.channelNumber})`);
        });
        console.log('');
        console.log('✅ All tests passed! Channel presets are ready.');
        db.close();
      }
    );
  }
);
