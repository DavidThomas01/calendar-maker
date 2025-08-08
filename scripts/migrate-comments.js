/**
 * Comments Migration Script
 * 
 * This script migrates comments from local file system to Vercel Blob storage
 * Run this once after deploying the updated code to production
 * 
 * Usage:
 *   node scripts/migrate-comments.js [VERCEL_PROJECT_URL]
 * 
 * Example:
 *   node scripts/migrate-comments.js https://your-project.vercel.app
 */

const fs = require('fs').promises;
const path = require('path');

async function migrateComments(projectUrl) {
  try {
    console.log('🚀 Starting comments migration...');
    
    // Read existing comments from local file
    const commentsFile = path.join(__dirname, '../data/comments.json');
    let localComments = [];
    
    try {
      const data = await fs.readFile(commentsFile, 'utf-8');
      localComments = JSON.parse(data);
      console.log(`📁 Found ${localComments.length} comments in local file`);
    } catch (error) {
      console.log('ℹ️  No local comments file found or file is empty');
      return;
    }

    if (localComments.length === 0) {
      console.log('ℹ️  No comments to migrate');
      return;
    }

    // Check migration status first
    console.log('🔍 Checking migration status...');
    const statusUrl = `${projectUrl}/api/migrate-comments`;
    const statusResponse = await fetch(statusUrl);
    const statusData = await statusResponse.json();
    
    console.log('📊 Migration Status:', {
      environment: statusData.environment,
      storageType: statusData.storageType,
      existingCommentsCount: statusData.commentsCount,
      migrationRequired: statusData.migrationRequired
    });

    if (!statusData.migrationRequired) {
      console.log('✅ Migration not required - comments already exist in production');
      console.log(`📈 Current comments count: ${statusData.commentsCount}`);
      return;
    }

    // Perform migration
    console.log('📤 Uploading comments to production...');
    const migrationUrl = `${projectUrl}/api/migrate-comments`;
    const migrationResponse = await fetch(migrationUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        comments: localComments,
        confirmMigration: true
      })
    });

    const migrationData = await migrationResponse.json();
    
    if (!migrationResponse.ok) {
      throw new Error(`Migration failed: ${migrationData.error} - ${migrationData.details}`);
    }

    console.log('✅ Migration completed successfully!');
    console.log(`📊 Migrated ${migrationData.migratedCommentsCount} comments`);
    console.log(`🔍 Verification count: ${migrationData.verificationCount}`);
    console.log(`⏰ Migration timestamp: ${migrationData.migrationTimestamp}`);
    
    // Show sample of migrated comments
    if (migrationData.migratedComments && migrationData.migratedComments.length > 0) {
      console.log('\n📝 Sample migrated comments:');
      migrationData.migratedComments.slice(0, 3).forEach((comment, index) => {
        console.log(`  ${index + 1}. [${comment.bookingId}] ${comment.text}`);
      });
      if (migrationData.migratedComments.length > 3) {
        console.log(`  ... and ${migrationData.migratedComments.length - 3} more`);
      }
    }
    
    console.log('\n🎉 Migration process completed! You can now test the comments system in production.');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Main execution
const projectUrl = process.argv[2];

if (!projectUrl) {
  console.error('❌ Error: Please provide the Vercel project URL');
  console.log('Usage: node scripts/migrate-comments.js [VERCEL_PROJECT_URL]');
  console.log('Example: node scripts/migrate-comments.js https://your-project.vercel.app');
  process.exit(1);
}

// Validate URL format
try {
  new URL(projectUrl);
} catch {
  console.error('❌ Error: Invalid URL format');
  console.log('Please provide a valid URL like: https://your-project.vercel.app');
  process.exit(1);
}

// Run migration
migrateComments(projectUrl);