# Environment Configuration Guide

## Overview
This document provides instructions for setting up the environment variables required for the calendar system to work in both development and production environments.

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
   - Test calendar generation functionality

## Development Environment

### Local Development
- No additional setup required for basic calendar functionality
- Upload CSV files to generate calendars



## Environment Detection Logic

The application automatically detects the environment for optimal performance.

## Troubleshooting

### Common Issues

1. **Calendar Generation Issues**
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