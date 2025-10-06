const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function insertQAPairs() {
  try {
    const qaPairs = JSON.parse(fs.readFileSync('/tmp/generated_qa_pairs.json', 'utf8'));
    
    console.log(`Inserting ${qaPairs.length} Q&A pairs...`);
    
    let successCount = 0;
    let errorCount = 0;
    const categoryStats = {};
    
    for (const qa of qaPairs) {
      try {
        await prisma.qAEntry.create({
          data: {
            question: qa.question,
            answer: qa.answer,
            category: qa.category,
            sourceType: qa.sourceType,
            confidence: qa.confidence,
            isActive: true
          }
        });
        
        successCount++;
        categoryStats[qa.category] = (categoryStats[qa.category] || 0) + 1;
        
      } catch (error) {
        console.error(`Error inserting Q&A: ${qa.question.substring(0, 50)}...`);
        console.error(error.message);
        errorCount++;
      }
    }
    
    console.log('\n=== Insertion Summary ===');
    console.log(`Successfully inserted: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log('\n=== Category Breakdown ===');
    Object.entries(categoryStats).sort((a, b) => b[1] - a[1]).forEach(([category, count]) => {
      console.log(`${category}: ${count} entries`);
    });
    
    // Get total count in database
    const totalCount = await prisma.qAEntry.count();
    console.log(`\nTotal Q&A entries in database: ${totalCount}`);
    
    // Show sample entries
    console.log('\n=== Sample Q&A Entries ===');
    const samples = await prisma.qAEntry.findMany({
      where: { sourceType: 'documentation' },
      take: 3,
      orderBy: { createdAt: 'desc' }
    });
    
    samples.forEach((entry, idx) => {
      console.log(`\n${idx + 1}. [${entry.category}] ${entry.question}`);
      console.log(`   Answer: ${entry.answer.substring(0, 100)}...`);
    });
    
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

insertQAPairs();
