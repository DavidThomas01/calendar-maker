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
 * Vercel KV storage adapter for production environment
 */
class VercelKVAdapter implements StorageAdapter {
  private readonly commentsKey = 'comments';

  async initialize(): Promise<void> {
    // No initialization needed for Vercel KV
    return Promise.resolve();
  }

  async readComments(): Promise<DayComment[]> {
    try {
      // Import Vercel KV dynamically to avoid issues in environments without it
      const { kv } = await import('@vercel/kv');
      
      const comments = await kv.get<DayComment[]>(this.commentsKey);
      
      if (!comments || !Array.isArray(comments)) {
        console.log('No comments found in KV, returning empty array');
        return [];
      }
      
      // Convert date strings back to Date objects
      return comments.map((comment: any) => ({
        ...comment,
        createdAt: new Date(comment.createdAt),
        updatedAt: new Date(comment.updatedAt)
      }));
    } catch (error) {
      console.error('Error reading comments from Vercel KV:', error);
      // In production, we don't want to fail completely, return empty array
      return [];
    }
  }

  async writeComments(comments: DayComment[]): Promise<void> {
    try {
      // Import Vercel KV dynamically
      const { kv } = await import('@vercel/kv');
      
      await kv.set(this.commentsKey, comments);
    } catch (error) {
      console.error('Error writing comments to Vercel KV:', error);
      throw new Error(`Failed to write comments to Vercel KV: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    console.log('Using Vercel KV storage adapter');
    return new VercelKVAdapter();
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