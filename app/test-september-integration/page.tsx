'use client';

import React, { useState } from 'react';
import { Calendar, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { loadStaticCSVReservations, mergeReservationsWithStaticCSV, parseCSVToReservations, filterReservationsForMonth, groupReservationsByApartment } from '@/lib/calendar-utils';
import { Reservation } from '@/lib/types';

export default function TestSeptemberIntegration() {
  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState<any[]>([]);
  const [error, setError] = useState<string>('');

  const runTests = async () => {
    setIsLoading(true);
    setError('');
    setTestResults([]);
    
    const results: any[] = [];
    
    try {
      // Test 1: Load static CSV reservations
      console.log('🧪 Test 1: Loading static CSV reservations...');
      const staticReservations = await loadStaticCSVReservations('september_2025_reservations.csv');
      results.push({
        test: 'Load Static CSV',
        success: staticReservations.length === 42,
        message: `Loaded ${staticReservations.length} reservations (expected 42)`,
        details: staticReservations.length > 0 ? `First guest: ${staticReservations[0].Name}, Last guest: ${staticReservations[staticReservations.length - 1].Name}` : 'No reservations loaded'
      });

      // Test 2: Check property name mapping
      console.log('🧪 Test 2: Checking property name mapping...');
      const propertyNames = new Set(staticReservations.map(r => r.HouseName));
      const expectedProperties = [
        'At Home in Madrid II, Centro, Prado, Barrio Letras',
        'At Home in Madrid III, Centro, Prado, BarrioLetras',
        'At Home in Madrid IV, Centro, Prado, Barrio Letras',
        'At Home in Madrid V, Centro, Prado, Barrio Letras',
        'At Home in Madrid VI, Centro, Prado, Barrio Letras',
        'At Home in Madrid VII, Trendy Neighborhood',
        'At Home in Madrid VIII, Centro, Prado, Letras',
        'At Home in Madrid IX, Trendy Chueca, Prado, GranVia',
        'At Home in Madrid X, Center, Prado, Barrio Letras'
      ];
      
      const mappedCorrectly = expectedProperties.every(prop => propertyNames.has(prop));
      results.push({
        test: 'Property Name Mapping',
        success: mappedCorrectly,
        message: mappedCorrectly ? 'All property names correctly mapped' : 'Some property names incorrect',
        details: `Found properties: ${Array.from(propertyNames).join(', ')}`
      });

      // Test 3: Check date parsing
      console.log('🧪 Test 3: Checking date parsing...');
      const validDates = staticReservations.every(r => 
        r.DateArrival instanceof Date && !isNaN(r.DateArrival.getTime()) &&
        r.DateDeparture instanceof Date && !isNaN(r.DateDeparture.getTime())
      );
      const septemberReservations = staticReservations.filter(r => 
        r.DateArrival.getMonth() === 8 || r.DateDeparture.getMonth() === 8  // September is month 8 (0-indexed)
      );
      results.push({
        test: 'Date Parsing',
        success: validDates,
        message: validDates ? 'All dates parsed correctly' : 'Some dates invalid',
        details: `${septemberReservations.length} reservations in September 2025`
      });

      // Test 4: Test merge functionality
      console.log('🧪 Test 4: Testing merge functionality...');
      const mockExistingReservations: Reservation[] = [
        {
          Id: 'MOCK001',
          Type: 'Booking',
          Source: 'Lodgify',
          SourceText: 'MOCK001',
          Name: 'Mock Guest',
          DateArrival: new Date('2025-09-01'),
          DateDeparture: new Date('2025-09-03'),
          Nights: 2,
          HouseName: 'At Home in Madrid II, Centro, Prado, Barrio Letras',
          InternalCode: '',
          House_Id: '685242',
          RoomTypes: 'At Home in Madrid II  Centro  Prado  Barrio Letras',
          People: 2,
          DateCreated: new Date('2025-08-01'),
          TotalAmount: 400,
          Currency: 'EUR',
          Status: 'Booked',
          Email: 'mock@email.com',
          Phone: '',
          CountryName: 'Spain'
        }
      ];
      
      const mergedReservations = await mergeReservationsWithStaticCSV(mockExistingReservations);
      const totalAfterMerge = mergedReservations.length;
      const hasOriginalMock = mergedReservations.some(r => r.Id === 'MOCK001');
      const hasStaticReservations = mergedReservations.some(r => r.Id.startsWith('SEP2025'));
      
      results.push({
        test: 'Merge Functionality',
        success: totalAfterMerge > 1 && hasOriginalMock && hasStaticReservations,
        message: `Merged ${totalAfterMerge} total reservations`,
        details: `Mock preserved: ${hasOriginalMock}, Static added: ${hasStaticReservations}`
      });

      // Test 5: Test September 2025 filtering
      console.log('🧪 Test 5: Testing September 2025 filtering...');
      const september2025Reservations = filterReservationsForMonth(staticReservations, 2025, 9);
      const allInSeptember = september2025Reservations.every(r => {
        const arrival = r.DateArrival;
        const departure = r.DateDeparture;
        const septemberStart = new Date(2025, 8, 1);  // September 1, 2025
        const septemberEnd = new Date(2025, 8, 30);   // September 30, 2025
        return (arrival <= septemberEnd && departure >= septemberStart);
      });
      
      results.push({
        test: 'September 2025 Filtering',
        success: allInSeptember && september2025Reservations.length > 0,
        message: `${september2025Reservations.length} reservations overlap with September 2025`,
        details: allInSeptember ? 'All filtered reservations overlap correctly' : 'Some reservations don\'t overlap with September'
      });

      // Test 6: Test apartment grouping
      console.log('🧪 Test 6: Testing apartment grouping...');
      const apartmentGroups = groupReservationsByApartment(staticReservations);
      const expectedApartments = 9; // We should have 9 different apartments (II, III, IV, V, VI, VII, VIII, IX, X)
      const groupCount = apartmentGroups.size;
      
      results.push({
        test: 'Apartment Grouping',
        success: groupCount === expectedApartments,
        message: `Grouped into ${groupCount} apartments (expected ${expectedApartments})`,
        details: Array.from(apartmentGroups.keys()).join(', ')
      });

      // Test 7: Verify guest names are preserved
      console.log('🧪 Test 7: Verifying specific guest names...');
      const expectedGuests = ['Alberto', 'Vladimir', 'Saige', 'John', 'Beth', 'Pepe', 'Carol', 'Mark', 'Signe'];
      const foundGuests = expectedGuests.filter(guest => 
        staticReservations.some(r => r.Name === guest)
      );
      
      results.push({
        test: 'Guest Names Preservation',
        success: foundGuests.length === expectedGuests.length,
        message: `Found ${foundGuests.length}/${expectedGuests.length} expected guests`,
        details: `Found: ${foundGuests.join(', ')}`
      });

      setTestResults(results);
      
    } catch (error) {
      console.error('❌ Test error:', error);
      setError(`Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const successCount = testResults.filter(r => r.success).length;
  const totalCount = testResults.length;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center mb-6">
            <Calendar className="h-8 w-8 text-blue-600 mr-3" />
            <h1 className="text-3xl font-bold text-gray-800">September 2025 Integration Test</h1>
          </div>

          <div className="mb-6">
            <button
              onClick={runTests}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md font-medium flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-5 w-5 mr-2" />
              )}
              {isLoading ? 'Running Tests...' : 'Run Integration Tests'}
            </button>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
                <span className="text-red-800 font-medium">Error</span>
              </div>
              <p className="text-red-700 mt-1">{error}</p>
            </div>
          )}

          {testResults.length > 0 && (
            <div className="space-y-4">
              <div className="bg-gray-100 rounded-md p-4">
                <h2 className="text-xl font-semibold text-gray-800 mb-2">
                  Test Results: {successCount}/{totalCount} Passed
                </h2>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${(successCount / totalCount) * 100}%` }}
                  />
                </div>
              </div>

              {testResults.map((result, index) => (
                <div
                  key={index}
                  className={`border rounded-md p-4 ${
                    result.success
                      ? 'border-green-200 bg-green-50'
                      : 'border-red-200 bg-red-50'
                  }`}
                >
                  <div className="flex items-center mb-2">
                    {result.success ? (
                      <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
                    )}
                    <span className={`font-medium ${
                      result.success ? 'text-green-800' : 'text-red-800'
                    }`}>
                      {result.test}
                    </span>
                  </div>
                  <p className={`${
                    result.success ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {result.message}
                  </p>
                  {result.details && (
                    <p className={`text-sm mt-1 ${
                      result.success ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {result.details}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-md p-4">
            <h3 className="text-lg font-semibold text-blue-800 mb-2">How to Test in Calendar Views</h3>
            <ol className="list-decimal list-inside text-blue-700 space-y-1">
              <li>Navigate to <strong>Staff Calendar</strong> and select September 2025</li>
              <li>Navigate to <strong>Admin Calendar</strong> and select September 2025</li>
              <li>Look for guest names like Alberto, Vladimir, Saige, John, etc.</li>
              <li>Verify reservations show in Airbnb purple color (#A020F0)</li>
              <li>Check that check-in/check-out dates match the original data</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

