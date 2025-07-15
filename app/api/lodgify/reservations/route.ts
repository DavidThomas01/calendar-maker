import { NextRequest, NextResponse } from 'next/server';

const LODGIFY_API_KEY = 'TFmIOEzIyDHYGWRuZ3ek24i7din//hJRGZa49+Gi3VMBr7FdjTDWaVvxijQ3DLBP';
const LODGIFY_BASE_URL = 'https://api.lodgify.com/v2';

// Define confirmed status values
const CONFIRMED_STATUSES = ['Booked', 'confirmed', 'Confirmed'];

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const includeAll = searchParams.get('includeAll') === 'true'; // Optional parameter to get all statuses

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    console.log(`Fetching ALL reservations from ${startDate} to ${endDate}...`);
    if (!includeAll) {
      console.log(`Filtering for confirmed reservations only (${CONFIRMED_STATUSES.join(', ')})`);
    }

    // Fetch all reservations by iterating through all pages
    const allReservations = [];
    let page = 1;
    let hasMoreData = true;
    const limit = 50; // Lodgify seems to cap at 50 per page regardless of what we request

    while (hasMoreData) {
      console.log(`Fetching page ${page}...`);
      
      const url = `${LODGIFY_BASE_URL}/reservations/bookings?startDate=${startDate}&endDate=${endDate}&page=${page}&limit=${limit}`;

      const response = await fetch(url, {
        headers: {
          'X-ApiKey': LODGIFY_API_KEY,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Lodgify API Error:', response.status, errorText);
        
        if (response.status === 401) {
          return NextResponse.json(
            { error: 'Clave API inválida. Verifica tu clave API de Lodgify.' },
            { status: 401 }
          );
        }
        
        return NextResponse.json(
          { error: `Error del servidor Lodgify: ${response.status}` },
          { status: response.status }
        );
      }

      const data = await response.json();
      const pageReservations = data.items || data || [];
      
      console.log(`Page ${page}: Found ${pageReservations.length} reservations`);
      
      if (pageReservations.length > 0) {
        // Filter for confirmed reservations only (unless includeAll is true)
        const filteredReservations = includeAll 
          ? pageReservations 
          : pageReservations.filter(reservation => 
              CONFIRMED_STATUSES.includes(reservation.status)
            );
        
        console.log(`Page ${page}: ${filteredReservations.length} confirmed reservations (${pageReservations.length} total)`);
        
        allReservations.push(...filteredReservations);
        page++;
        
        // If we got less than the limit, we've reached the end
        if (pageReservations.length < limit) {
          hasMoreData = false;
        }
      } else {
        hasMoreData = false;
      }
      
      // Safety check to prevent infinite loops
      if (page > 20) {
        console.warn('Reached maximum page limit (20), stopping pagination');
        hasMoreData = false;
      }
    }

    console.log(`Total confirmed reservations fetched: ${allReservations.length}`);

    // Count reservations by property to verify we have data from all properties
    const propertyStats = {};
    const statusStats = {};
    
    allReservations.forEach(reservation => {
      const propertyId = reservation.property_id;
      const status = reservation.status;
      
      if (!propertyStats[propertyId]) {
        propertyStats[propertyId] = 0;
      }
      propertyStats[propertyId]++;
      
      if (!statusStats[status]) {
        statusStats[status] = 0;
      }
      statusStats[status]++;
    });

    console.log('Confirmed reservations per property:', propertyStats);
    console.log('Status breakdown:', statusStats);
    console.log(`Data from ${Object.keys(propertyStats).length} properties found`);

    // Return all confirmed reservations in the same format as before
    const result = {
      items: allReservations,
      count: allReservations.length,
      totalPages: page - 1,
      propertiesFound: Object.keys(propertyStats).length,
      propertyStats: propertyStats,
      statusStats: statusStats,
      filterApplied: !includeAll ? `Confirmed only (${CONFIRMED_STATUSES.join(', ')})` : 'All statuses included'
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error calling Lodgify API:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor al conectar con Lodgify' },
      { status: 500 }
    );
  }
} 