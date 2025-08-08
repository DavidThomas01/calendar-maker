import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { DayComment } from '@/lib/types';
import { CommentsStorageService } from '@/lib/storage';

/**
 * Migration endpoint to transfer comments from local file system to Vercel Blob storage
 * This should be called once after deployment to migrate existing data
 */
export async function POST(request: NextRequest) {
  try {
    // Check if we're in production/Vercel environment
    const isVercel = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
    
    if (!isVercel) {
      return NextResponse.json(
        { 
          error: 'Migration endpoint is only available in production environment',
          environment: 'development'
        },
        { status: 400 }
      );
    }

    // Initialize storage service (will use Vercel Blob in production)
    const storageService = CommentsStorageService.getInstance();

    // Check if migration has already been performed
    const existingComments = await storageService.readComments();
    if (existingComments.length > 0) {
      return NextResponse.json({
        message: 'Migration already completed',
        existingCommentsCount: existingComments.length,
        migrationRequired: false
      });
    }

    // Read the migration data from the request body
    const body = await request.json();
    const { comments: migrationData, confirmMigration } = body;

    if (!confirmMigration) {
      return NextResponse.json(
        { error: 'Migration confirmation required. Set confirmMigration: true' },
        { status: 400 }
      );
    }

    if (!migrationData || !Array.isArray(migrationData)) {
      return NextResponse.json(
        { error: 'Migration data required. Provide comments array in request body' },
        { status: 400 }
      );
    }

    // Validate migration data structure
    const validatedComments: DayComment[] = migrationData.map((comment: any, index: number) => {
      if (!comment.id || !comment.bookingId || !comment.apartmentName || !comment.text) {
        throw new Error(`Invalid comment structure at index ${index}: missing required fields`);
      }

      return {
        id: comment.id,
        bookingId: comment.bookingId,
        apartmentName: comment.apartmentName,
        date: comment.date,
        text: comment.text,
        fontSize: comment.fontSize || 'medium',
        createdAt: new Date(comment.createdAt),
        updatedAt: new Date(comment.updatedAt),
        createdBy: comment.createdBy || 'owner'
      };
    });

    // Perform the migration
    await storageService.writeComments(validatedComments);

    // Verify migration was successful
    const verificationComments = await storageService.readComments();

    return NextResponse.json({
      message: 'Migration completed successfully',
      migratedCommentsCount: validatedComments.length,
      verificationCount: verificationComments.length,
      migrationTimestamp: new Date().toISOString(),
      migratedComments: validatedComments.map(c => ({
        id: c.id,
        bookingId: c.bookingId,
        text: c.text.substring(0, 50) + (c.text.length > 50 ? '...' : '')
      }))
    });

  } catch (error) {
    console.error('Migration error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { 
        error: 'Migration failed',
        details: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check migration status
 */
export async function GET(request: NextRequest) {
  try {
    const isVercel = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
    const storageService = CommentsStorageService.getInstance();
    
    const existingComments = await storageService.readComments();
    
    return NextResponse.json({
      environment: isVercel ? 'production' : 'development',
      storageType: isVercel ? 'vercel-blob' : 'local-filesystem',
      commentsCount: existingComments.length,
      migrationRequired: isVercel && existingComments.length === 0,
      comments: existingComments.map(c => ({
        id: c.id,
        bookingId: c.bookingId,
        date: c.date,
        text: c.text.substring(0, 30) + (c.text.length > 30 ? '...' : ''),
        createdAt: c.createdAt
      }))
    });

  } catch (error) {
    console.error('Migration status check error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { 
        error: 'Failed to check migration status',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}