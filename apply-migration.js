const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'prisma/data/sports_bar.db');
const migrationPath = path.join(__dirname, 'drizzle/0002_clean_franklin_richards.sql');

console.log('Applying migration to:', dbPath);

const db = new Database(dbPath);
const migration = fs.readFileSync(migrationPath, 'utf8');

// Split by statement-breakpoint and execute each statement
const statements = migration.split('--> statement-breakpoint');

statements.forEach((statement, index) => {
  const trimmedStatement = statement.trim();
  if (trimmedStatement && !trimmedStatement.startsWith('-->')) {
    try {
      db.exec(trimmedStatement);
      console.log(`Executed statement ${index + 1}`);
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log(`Statement ${index + 1} skipped (already exists)`);
      } else {
        console.error(`Error executing statement ${index + 1}:`, error.message);
      }
    }
  }
});

db.close();
console.log('Migration completed!');
