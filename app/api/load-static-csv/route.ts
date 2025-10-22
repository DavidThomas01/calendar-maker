import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');

    if (!filename) {
      return NextResponse.json({ error: 'Filename parameter is required' }, { status: 400 });
    }

    // Security check: only allow CSV files and prevent directory traversal
    if (!filename.endsWith('.csv') || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    const csvPath = path.join(process.cwd(), 'data', filename);
    
    // Check if file exists
    if (!fs.existsSync(csvPath)) {
      return NextResponse.json({ error: `File ${filename} not found` }, { status: 404 });
    }

    console.log(`📂 Loading static CSV file: ${csvPath}`);
    
    const csvData = fs.readFileSync(csvPath, 'utf8');
    
    return new Promise<Response>((resolve) => {
      Papa.parse(csvData, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            console.error('❌ CSV parsing errors:', results.errors);
            resolve(NextResponse.json({ 
              error: 'Failed to parse CSV file',
              details: results.errors 
            }, { status: 500 }));
            return;
          }
          
          console.log(`✅ Successfully parsed ${results.data.length} rows from ${filename}`);
          
          resolve(NextResponse.json({
            success: true,
            filename,
            reservations: results.data,
            totalReservations: results.data.length
          }));
        },
        error: (error: any) => {
          console.error('❌ CSV parsing error:', error);
          resolve(NextResponse.json({ 
            error: 'Failed to parse CSV file',
            details: error.message 
          }, { status: 500 }));
        }
      });
    });
  } catch (error) {
    console.error('❌ Error loading static CSV:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
