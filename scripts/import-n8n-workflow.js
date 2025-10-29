#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Read the workflow JSON
const workflowPath = path.join(__dirname, '../n8n-workflows/ai-training-auto.json');
const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));

// Connect to n8n database
const dbPath = path.join(process.env.HOME, '.n8n/database.sqlite');
const db = new Database(dbPath);

// Generate UUID
const crypto = require('crypto');
const workflowId = 'b319e901-5960-438f-bb75-c8ce0c056b38';
const versionId = crypto.randomUUID();

// Prepare data
const nodes = JSON.stringify(workflow.nodes);
const connections = JSON.stringify(workflow.connections);
const settings = JSON.stringify(workflow.settings);
const staticData = workflow.staticData ? JSON.stringify(workflow.staticData) : null;

// Check if workflow already exists
const existing = db.prepare('SELECT id FROM workflow_entity WHERE name = ?').get(workflow.name);

if (existing) {
  console.log(`Workflow "${workflow.name}" already exists (ID: ${existing.id})`);
  console.log('Updating existing workflow...');

  db.prepare(`
    UPDATE workflow_entity
    SET nodes = ?,
        connections = ?,
        settings = ?,
        staticData = ?,
        versionId = ?,
        triggerCount = ?,
        updatedAt = datetime('now')
    WHERE id = ?
  `).run(nodes, connections, settings, staticData, versionId, workflow.triggerCount || 1, existing.id);

  console.log('✅ Workflow updated successfully!');
  console.log(`   ID: ${existing.id}`);
} else {
  console.log(`Creating new workflow: "${workflow.name}"`);

  // Insert the workflow
  db.prepare(`
    INSERT INTO workflow_entity (
      id, name, active, nodes, connections, settings, staticData,
      versionId, triggerCount, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(
    workflowId,
    workflow.name,
    0, // inactive by default
    nodes,
    connections,
    settings,
    staticData,
    versionId,
    workflow.triggerCount || 1
  );

  console.log('✅ Workflow imported successfully!');
  console.log(`   ID: ${workflowId}`);
}

console.log(`   Name: ${workflow.name}`);
console.log(`   Nodes: ${workflow.nodes.length}`);
console.log('');
console.log('Next steps:');
console.log('1. Open n8n: http://localhost:5678');
console.log(`2. Find the workflow: "${workflow.name}"`);
console.log('3. Configure the database credential if needed');
console.log('4. Activate the workflow');

db.close();
