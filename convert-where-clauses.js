#!/usr/bin/env node

/**
 * Convert WHERE Clauses to Drizzle Syntax
 * 
 * Converts: findFirst('chatSessions', { where: { id: sessionId } })
 * To: findFirst('chatSessions', { where: eq(schema.chatSessions.id, sessionId) })
 */

const fs = require('fs');
const path = require('path');

function convertWhereClause(filePath) {
  console.log(`\n🔄 Converting WHERE clauses in: ${filePath}`);
  
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    const originalContent = content;
    let changeCount = 0;
    
    // Pattern: findFirst/findMany/etc('tableName', { where: { field: value } })
    // This regex finds function calls with where clauses
    const wherePattern = /(\w+)\s*\(\s*['"](\w+)['"]\s*,\s*{\s*where:\s*({[^}]+})/g;
    
    content = content.replace(wherePattern, (match, operation, tableName, whereObj) => {
      try {
        // Simple WHERE clause conversion for single field
        const simpleFieldPattern = /{\s*(\w+):\s*(\w+)\s*}/;
        const fieldMatch = whereObj.match(simpleFieldPattern);
        
        if (fieldMatch) {
          const [, fieldName, value] = fieldMatch;
          changeCount++;
          return `${operation}('${tableName}', { where: eq(schema.${tableName}.${fieldName}, ${value})`;
        }
        
        return match; // Return unchanged if complex WHERE clause
      } catch (e) {
        return match;
      }
    });
    
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Converted ${changeCount} WHERE clauses`);
      return changeCount;
    } else {
      console.log(`⏭️  No WHERE clause conversions needed`);
      return 0;
    }
    
  } catch (error) {
    console.error(`❌ Error converting ${filePath}:`, error.message);
    return -1;
  }
}

async function main() {
  console.log('🚀 Starting WHERE Clause Conversion...\n');
  
  const {execSync} = require('child_process');
  
  try {
    const output = execSync('grep -r "where:" --include="*.ts" --include="*.tsx" src/ | grep -E "findFirst|findMany|findUnique|updateOne|deleteOne" | cut -d: -f1 | sort -u', {encoding: 'utf-8'});
    const files = output.trim().split('\n').filter(f => f);
    
    console.log(`📋 Found ${files.length} files with WHERE clauses\n`);
    
    let totalConverted = 0;
    
    for (const file of files) {
      const count = convertWhereClause(path.join(process.cwd(), file));
      if (count > 0) totalConverted += count;
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 Conversion Summary:');
    console.log('='.repeat(60));
    console.log(`✅ Total WHERE clauses converted: ${totalConverted}`);
    console.log('='.repeat(60));
    console.log('\n⚠️  Note: Complex WHERE clauses may need manual review');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main().catch(console.error);
