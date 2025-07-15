import { NextRequest, NextResponse } from 'next/server';

const LODGIFY_API_KEY = 'TFmIOEzIyDHYGWRuZ3ek24i7din//hJRGZa49+Gi3VMBr7FdjTDWaVvxijQ3DLBP';
const LODGIFY_BASE_URL = 'https://api.lodgify.com/v2';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const testType = searchParams.get('test') || 'all';
    
    const results: any = {
      testType,
      timestamp: new Date().toISOString(),
      tests: {}
    };

    console.log(`Starting Lodgify API comprehensive test: ${testType}`);

    // Test 1: Get all properties
    if (testType === 'all' || testType === 'properties') {
      console.log('Testing: Get all properties...');
      try {
        const propertiesUrl = `${LODGIFY_BASE_URL}/properties`;
        const propertiesResponse = await fetch(propertiesUrl, {
          headers: {
            'X-ApiKey': LODGIFY_API_KEY,
            'Content-Type': 'application/json'
          }
        });

        if (propertiesResponse.ok) {
          const propertiesData = await propertiesResponse.json();
          results.tests.properties = {
            success: true,
            count: propertiesData.length || propertiesData.items?.length || 0,
            data: propertiesData
          };
          console.log(`Properties found: ${results.tests.properties.count}`);
        } else {
          const errorText = await propertiesResponse.text();
          results.tests.properties = {
            success: false,
            status: propertiesResponse.status,
            error: errorText
          };
        }
      } catch (error) {
        results.tests.properties = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    // Test 2: Get reservations with different parameters
    if (testType === 'all' || testType === 'reservations') {
      console.log('Testing: Get reservations for August 2025...');
      
      const reservationTests = [
        {
          name: 'basic_august_2025',
          url: `${LODGIFY_BASE_URL}/reservations/bookings?startDate=2025-08-01&endDate=2025-08-31&limit=100`
        },
        {
          name: 'with_pagination_page1',
          url: `${LODGIFY_BASE_URL}/reservations/bookings?startDate=2025-08-01&endDate=2025-08-31&page=1&limit=50`
        },
        {
          name: 'with_pagination_page2',
          url: `${LODGIFY_BASE_URL}/reservations/bookings?startDate=2025-08-01&endDate=2025-08-31&page=2&limit=50`
        },
        {
          name: 'larger_limit',
          url: `${LODGIFY_BASE_URL}/reservations/bookings?startDate=2025-08-01&endDate=2025-08-31&limit=200`
        },
        {
          name: 'all_reservations_endpoint',
          url: `${LODGIFY_BASE_URL}/reservations?startDate=2025-08-01&endDate=2025-08-31&limit=200`
        }
      ];

      for (const test of reservationTests) {
        try {
          console.log(`Testing reservations: ${test.name}`);
          const response = await fetch(test.url, {
            headers: {
              'X-ApiKey': LODGIFY_API_KEY,
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            const data = await response.json();
            const reservations = data.items || data || [];
            results.tests[test.name] = {
              success: true,
              count: reservations.length,
              totalItems: data.totalItems || data.length,
              hasMore: data.hasMore,
              page: data.page,
              data: data
            };
            console.log(`${test.name}: Found ${reservations.length} reservations`);
          } else {
            const errorText = await response.text();
            results.tests[test.name] = {
              success: false,
              status: response.status,
              error: errorText
            };
          }
        } catch (error) {
          results.tests[test.name] = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      }
    }

    // Test 3: Test individual property reservations
    if (testType === 'all' || testType === 'property_reservations') {
      console.log('Testing: Get reservations by property...');
      
      // Test known property IDs from CSV
      const propertyIds = [685245, 685237, 685239, 685240, 685238, 685244, 685246, 685243, 685242, 685241];
      
      for (const propertyId of propertyIds) {
        try {
          console.log(`Testing property ${propertyId}...`);
          const url = `${LODGIFY_BASE_URL}/reservations/bookings?startDate=2025-08-01&endDate=2025-08-31&propertyId=${propertyId}&limit=100`;
          
          const response = await fetch(url, {
            headers: {
              'X-ApiKey': LODGIFY_API_KEY,
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            const data = await response.json();
            const reservations = data.items || data || [];
            results.tests[`property_${propertyId}`] = {
              success: true,
              count: reservations.length,
              data: data
            };
            console.log(`Property ${propertyId}: Found ${reservations.length} reservations`);
          } else {
            const errorText = await response.text();
            results.tests[`property_${propertyId}`] = {
              success: false,
              status: response.status,
              error: errorText
            };
          }
        } catch (error) {
          results.tests[`property_${propertyId}`] = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      }
    }

    // Test 4: Check API rate limits and available endpoints
    if (testType === 'all' || testType === 'api_info') {
      console.log('Testing: API info and limits...');
      
      const infoTests = [
        {
          name: 'account_info',
          url: `${LODGIFY_BASE_URL}/account`
        },
        {
          name: 'properties_detailed',
          url: `${LODGIFY_BASE_URL}/properties?includeInactive=true`
        }
      ];

      for (const test of infoTests) {
        try {
          console.log(`Testing API info: ${test.name}`);
          const response = await fetch(test.url, {
            headers: {
              'X-ApiKey': LODGIFY_API_KEY,
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            const data = await response.json();
            results.tests[test.name] = {
              success: true,
              data: data
            };
          } else {
            const errorText = await response.text();
            results.tests[test.name] = {
              success: false,
              status: response.status,
              error: errorText
            };
          }
        } catch (error) {
          results.tests[test.name] = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      }
    }

    console.log('Lodgify API comprehensive test completed');
    return NextResponse.json(results, { status: 200 });

  } catch (error) {
    console.error('Error in comprehensive Lodgify API test:', error);
    return NextResponse.json(
      { error: 'Error in comprehensive test', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 