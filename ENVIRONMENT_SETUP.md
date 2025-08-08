# Environment Configuration Guide

## Overview
This document provides instructions for setting up the environment variables required for the comments system to work in both development and production environments.

## Production Environment (Vercel)

### Required Setup in Vercel Dashboard

1. **Access Vercel Dashboard**
   - Go to [vercel.com](https://vercel.com)
   - Navigate to your project
   - Go to Settings → Environment Variables

2. **Automatic Vercel Blob Configuration**
   - Vercel Blob automatically provides the required environment variables when you use the `@vercel/blob` package
   - No manual environment variable setup is required for production
   - The `BLOB_READ_WRITE_TOKEN` is automatically injected by Vercel

3. **Verification**
   - After deploying, check the Function Logs in Vercel dashboard
   - Look for "Using Vercel Blob storage adapter" in the logs
   - Test comment creation/deletion functionality

## Development Environment

### Option 1: Use Local File System (Recommended for Development)
- No setup required
- Comments are stored in `data/comments.json`
- Storage adapter automatically detects local environment
- Look for "Using local file system storage adapter" in console logs

### Option 2: Use Vercel Blob in Development (Optional)
If you want to test with Vercel Blob locally:

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Login and Link Project**
   ```bash
   vercel login
   vercel link
   ```

3. **Pull Environment Variables**
   ```bash
   vercel env pull .env.local
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

## Environment Detection Logic

The storage system automatically detects the environment:

```typescript
const isVercel = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
```

- **Development**: Uses local file system storage
- **Production/Vercel**: Uses Vercel Blob storage

## Troubleshooting

### Common Issues

1. **"Failed to write comments to Vercel Blob" Error**
   - Check that `@vercel/blob` package is installed
   - Verify the project is deployed to Vercel (not another platform)
   - Check Vercel Function logs for detailed error messages

2. **"Using local file system storage adapter" in Production**
   - Ensure environment variables are properly set in Vercel
   - Check that `process.env.VERCEL` is set to '1' in production

3. **Local Development Issues**
   - Ensure `data/` directory exists and is writable
   - Check file permissions
   - Verify Node.js has write access to the project directory

### Debugging Environment Detection

Add this to your API route for debugging:

```typescript
console.log('Environment check:', {
  VERCEL: process.env.VERCEL,
  NODE_ENV: process.env.NODE_ENV,
  isVercel: process.env.VERCEL === '1' || process.env.NODE_ENV === 'production'
});
```

## Security Notes

- Environment variables are automatically secured by Vercel
- No sensitive credentials need to be manually configured
- Vercel Blob access is controlled through the Vercel platform
- Local development files are ignored by git (`.env*.local` in `.gitignore`)

## Migration Checklist

- [ ] Verify `@vercel/blob` is in `package.json` dependencies
- [ ] Deploy updated code to Vercel
- [ ] Test comment creation in production
- [ ] Monitor Vercel Function logs for any errors
- [ ] Verify automatic environment detection is working