import { NextRequest, NextResponse } from 'next/server';
import { Reservation } from '@/lib/types';
import Papa from 'papaparse';
import * as ical from 'node-ical';
import fs from 'fs';
import path from 'path';

interface VrboIcalLink {
  apartment_name: string;
  ical_url: string;
}

interface IcalEvent {
  type: string;
  start?: Date;
  end?: Date;
  summary?: string;
  description?: string;
  uid?: string;
  created?: Date;
  lastmodified?: Date;
}

// Cache for ICAL data to avoid excessive requests
const icalCache = new Map<string, { data: Reservation[], lastFetch: number }>();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

async function fetchIcalData(url: string): Promise<IcalEvent[]> {
  try {
    console.log(`📅 Fetching ICAL data from: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VRBO Calendar Sync)',
      },
      // Add timeout
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const icalText = await response.text();
    console.log(`📅 ICAL data length: ${icalText.length} characters`);
    
    // Parse ICAL data
    const events = ical.parseICS(icalText);
    
    // Convert to array and filter for VEVENT types
    const icalEvents: IcalEvent[] = Object.values(events)
      .filter((event: any) => event.type === 'VEVENT')
      .map((event: any) => ({
        type: event.type,
        start: event.start,
        end: event.end,
        summary: event.summary,
        description: event.description,
        uid: event.uid,
        created: event.created,
        lastmodified: event.lastmodified,
      }));

    console.log(`📅 Parsed ${icalEvents.length} events from ICAL`);
    return icalEvents;
  } catch (error) {
    console.error(`❌ Error fetching ICAL from ${url}:`, error);
    throw error;
  }
}

function convertIcalEventToReservation(event: IcalEvent, apartmentName: string): Reservation | null {
  if (!event.start || !event.end) {
    console.warn('⚠️ Event missing start or end date, skipping:', event.uid);
    return null;
  }

  // Calculate nights between dates
  const startDate = new Date(event.start);
  const endDate = new Date(event.end);
  const nights = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  if (nights <= 0) {
    console.warn('⚠️ Invalid date range, skipping event:', event.uid);
    return null;
  }

  // Generate unique ID for VRBO sync reservation
  const timestamp = Date.now();
  const apartmentCode = apartmentName.match(/At Home in Madrid (I+|V+|X+)/)?.[1] || 'Unknown';
  const reservationId = `VRBO_SYNC_${timestamp}_${apartmentCode}_${event.uid?.slice(-8) || 'unknown'}`;

  const reservation: Reservation = {
    Id: reservationId,
    Type: 'Booking',
    Source: 'VRBO', // This will trigger the green color #10B981
    SourceText: 'VRBO ICAL Sync',
    Name: 'vrbo-sync-res', // As specified in requirements
    DateArrival: startDate,
    DateDeparture: endDate,
    Nights: nights,
    HouseName: apartmentName,
    InternalCode: apartmentCode,
    House_Id: apartmentCode,
    RoomTypes: 'Standard',
    People: 2, // Default value since ICAL doesn't usually contain this
    DateCreated: event.created || new Date(),
    TotalAmount: 0, // ICAL typically doesn't contain pricing
    Currency: 'EUR',
    Status: 'Booked', // All ICAL events are considered booked
    Email: '', // Not available in ICAL
    Phone: '', // Not available in ICAL
    CountryName: '', // Not available in ICAL
  };

  console.log(`✅ Created reservation: ${reservationId} for ${apartmentName} (${nights} nights)`);
  return reservation;
}

async function loadVrboIcalLinks(): Promise<VrboIcalLink[]> {
  try {
    const csvPath = path.join(process.cwd(), 'data', 'vrbo_ical_sync_links.csv');
    const csvData = fs.readFileSync(csvPath, 'utf8');
    
    return new Promise((resolve, reject) => {
      Papa.parse(csvData, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            console.error('❌ CSV parsing errors:', results.errors);
            reject(new Error('Failed to parse VRBO ICAL links CSV'));
            return;
          }
          
          const links = results.data as VrboIcalLink[];
          console.log(`📋 Loaded ${links.length} VRBO ICAL links from CSV`);
          resolve(links);
        },
        error: (error: any) => {
          console.error('❌ CSV parsing error:', error);
          reject(error);
        }
      });
    });
  } catch (error) {
    console.error('❌ Error loading VRBO ICAL links:', error);
    throw error;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const apartment = searchParams.get('apartment');
    const forceRefresh = searchParams.get('refresh') === 'true';

    console.log(`🔄 VRBO ICAL Sync request - Apartment: ${apartment || 'ALL'}, Force refresh: ${forceRefresh}`);

    // Load VRBO ICAL links from CSV
    const vrboLinks = await loadVrboIcalLinks();

    if (!vrboLinks || vrboLinks.length === 0) {
      return NextResponse.json({ 
        error: 'No VRBO ICAL links found',
        reservations: [] 
      }, { status: 400 });
    }

    let linksToProcess = vrboLinks;

    // Filter for specific apartment if requested
    if (apartment) {
      linksToProcess = vrboLinks.filter(link => 
        link.apartment_name.toLowerCase().includes(apartment.toLowerCase())
      );
      
      if (linksToProcess.length === 0) {
        return NextResponse.json({ 
          error: `No ICAL links found for apartment: ${apartment}`,
          reservations: [] 
        }, { status: 404 });
      }
    }

    const allReservations: Reservation[] = [];
    const errors: string[] = [];

    // Process each ICAL link
    for (const link of linksToProcess) {
      try {
        const cacheKey = link.ical_url;
        const now = Date.now();
        
        // Check cache first (unless force refresh)
        if (!forceRefresh && icalCache.has(cacheKey)) {
          const cached = icalCache.get(cacheKey)!;
          if (now - cached.lastFetch < CACHE_DURATION) {
            console.log(`💾 Using cached data for ${link.apartment_name}`);
            allReservations.push(...cached.data);
            continue;
          }
        }

        // Fetch and parse ICAL data
        const events = await fetchIcalData(link.ical_url);
        const reservations: Reservation[] = [];

        for (const event of events) {
          const reservation = convertIcalEventToReservation(event, link.apartment_name);
          if (reservation) {
            reservations.push(reservation);
          }
        }

        // Update cache
        icalCache.set(cacheKey, {
          data: reservations,
          lastFetch: now
        });

        allReservations.push(...reservations);
        console.log(`✅ Processed ${reservations.length} reservations for ${link.apartment_name}`);

      } catch (error) {
        const errorMsg = `Failed to sync ${link.apartment_name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    console.log(`🎉 VRBO ICAL Sync completed - Total reservations: ${allReservations.length}, Errors: ${errors.length}`);

    return NextResponse.json({
      success: true,
      reservations: allReservations,
      processedApartments: linksToProcess.length,
      totalReservations: allReservations.length,
      errors: errors.length > 0 ? errors : undefined,
      lastSync: new Date().toISOString(),
    });

  } catch (error) {
    console.error('❌ VRBO ICAL Sync API Error:', error);
    return NextResponse.json({
      error: 'Internal server error during VRBO ICAL sync',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // Allow manual sync trigger via POST
  return GET(request);
}