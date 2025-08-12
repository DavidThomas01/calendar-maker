import { DayComment } from '@/lib/types';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Storage adapter interface for comment persistence
 * Supports both local file system (development) and Vercel Blob (production)
 */
export interface StorageAdapter {
  readComments(): Promise<DayComment[]>;
  writeComments(comments: DayComment[]): Promise<void>;
  initialize(): Promise<void>;
}

/**
 * Local file system storage adapter for development environment
 */
class LocalFileSystemAdapter implements StorageAdapter {
  private readonly commentsFile: string;

  constructor() {
    this.commentsFile = path.join(process.cwd(), 'data', 'comments.json');
  }

  async initialize(): Promise<void> {
    try {
      const dataDir = path.join(process.cwd(), 'data');
      await fs.mkdir(dataDir, { recursive: true });
      
      try {
        await fs.access(this.commentsFile);
      } catch {
        // File doesn't exist, create it with empty array
        await fs.writeFile(this.commentsFile, JSON.stringify([], null, 2));
      }
    } catch (error) {
      console.error('Error ensuring comments file:', error);
      throw new Error('Failed to initialize local storage');
    }
  }

  async readComments(): Promise<DayComment[]> {
    try {
      await this.initialize();
      const data = await fs.readFile(this.commentsFile, 'utf-8');
      const comments = JSON.parse(data);
      
      // Convert date strings back to Date objects
      return comments.map((comment: any) => ({
        ...comment,
        createdAt: new Date(comment.createdAt),
        updatedAt: new Date(comment.updatedAt)
      }));
    } catch (error) {
      console.error('Error reading comments from local storage:', error);
      return [];
    }
  }

  async writeComments(comments: DayComment[]): Promise<void> {
    try {
      await this.initialize();
      await fs.writeFile(this.commentsFile, JSON.stringify(comments, null, 2));
    } catch (error) {
      console.error('Error writing comments to local storage:', error);
      throw new Error('Failed to write comments to local storage');
    }
  }
}

/**
 * Vercel Blob storage adapter for production environment
 */
class VercelBlobAdapter implements StorageAdapter {
  private readonly blobKey = 'comments.json';

  async initialize(): Promise<void> {
    // No initialization needed for Vercel Blob
    return Promise.resolve();
  }

  async readComments(): Promise<DayComment[]> {
    try {
      // Import Vercel Blob dynamically to avoid issues in environments without it
      const { head, get } = await import('@vercel/blob');
      
      try {
        // First, check if the blob exists using head()
        await head(this.blobKey);
        
        // Get the blob content directly using the authenticated get() method
        const blob = await get(this.blobKey);
        
        if (!blob) {
          console.log('No comments blob found, returning empty array');
          return [];
        }
        
        // Convert blob to text
        const text = await blob.text();
        if (!text.trim()) {
          console.log('Empty blob content, returning empty array');
          return [];
        }
        
        const comments = JSON.parse(text);
        
        // Ensure comments is an array
        if (!Array.isArray(comments)) {
          console.warn('Comments data is not an array, returning empty array');
          return [];
        }
        
        // Convert date strings back to Date objects
        return comments.map((comment: any) => ({
          ...comment,
          createdAt: new Date(comment.createdAt),
          updatedAt: new Date(comment.updatedAt)
        }));
      } catch (error: any) {
        if (error.message?.includes('404') || error.status === 404 || error.message?.includes('BlobNotFoundError') || error.message?.includes('The specified blob does not exist')) {
          // Blob doesn't exist yet, return empty array
          console.log('Comments blob not found, returning empty array');
          return [];
        }
        throw error;
      }
    } catch (error) {
      console.error('Error reading comments from Vercel Blob:', error);
      // In production, we don't want to fail completely, return empty array
      return [];
    }
  }

  async writeComments(comments: DayComment[]): Promise<void> {
    try {
      // Import Vercel Blob dynamically
      const { put } = await import('@vercel/blob');
      
      // Ensure comments is an array
      if (!Array.isArray(comments)) {
        throw new Error('Comments must be an array');
      }
      
      const jsonString = JSON.stringify(comments, null, 2);
      console.log(`Writing ${comments.length} comments to Vercel Blob (${jsonString.length} bytes)`);
      
      const result = await put(this.blobKey, jsonString, {
        access: 'public', // We control access through our API
        contentType: 'application/json',
        allowOverwrite: true, // Allow overwriting existing blob
      });
      
      console.log(`Successfully wrote comments to Vercel Blob: ${result.url}`);
    } catch (error) {
      console.error('Error writing comments to Vercel Blob:', error);
      throw new Error(`Failed to write comments to Vercel Blob: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Storage factory that returns the appropriate adapter based on environment
 */
export function createStorageAdapter(): StorageAdapter {
  // Check if we're in a Vercel environment
  const isVercel = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
  
  if (isVercel) {
    console.log('Using Vercel Blob storage adapter');
    return new VercelBlobAdapter();
  } else {
    console.log('Using local file system storage adapter');
    return new LocalFileSystemAdapter();
  }
}

/**
 * Storage service singleton for comment operations
 */
export class CommentsStorageService {
  private static instance: CommentsStorageService;
  private adapter: StorageAdapter;

  private constructor() {
    this.adapter = createStorageAdapter();
  }

  public static getInstance(): CommentsStorageService {
    if (!CommentsStorageService.instance) {
      CommentsStorageService.instance = new CommentsStorageService();
    }
    return CommentsStorageService.instance;
  }

  async readComments(): Promise<DayComment[]> {
    return this.adapter.readComments();
  }

  async writeComments(comments: DayComment[]): Promise<void> {
    return this.adapter.writeComments(comments);
  }

  async initialize(): Promise<void> {
    return this.adapter.initialize();
  }
}