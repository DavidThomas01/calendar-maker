'use client';

import { useState, useEffect } from 'react';
import { loadStaticCSVReservations } from '@/lib/calendar-utils';
import { Reservation } from '@/lib/types';

export default function TestOctoberIntegration() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const loadReservations = async () => {
      try {
        setLoading(true);
        console.log('🔄 Loading October 2025 reservations...');
        
        const octReservations = await loadStaticCSVReservations('october_2025_reservations.csv');
        
        console.log(`📊 Loaded ${octReservations.length} October reservations`);
        setReservations(octReservations);
        
      } catch (err) {
        console.error('❌ Error loading October reservations:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    loadReservations();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading October 2025 reservations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">❌ Error</div>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'Airbnb': return '#A020F0';
      case 'VRBO': return '#10B981';
      default: return '#666666';
    }
  };

  const apartmentStats = reservations.reduce((acc, res) => {
    const apartment = res.HouseName;
    if (!acc[apartment]) {
      acc[apartment] = { total: 0, airbnb: 0, vrbo: 0 };
    }
    acc[apartment].total++;
    if (res.Source === 'Airbnb') acc[apartment].airbnb++;
    if (res.Source === 'VRBO') acc[apartment].vrbo++;
    return acc;
  }, {} as Record<string, { total: number; airbnb: number; vrbo: number; }>);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            October 2025 Reservations Integration Test
          </h1>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{reservations.length}</div>
                <div className="text-gray-600">Total Reservations</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600">
                  {reservations.filter(r => r.Source === 'Airbnb').length}
                </div>
                <div className="text-gray-600">Airbnb Bookings</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">
                  {reservations.filter(r => r.Source === 'VRBO').length}
                </div>
                <div className="text-gray-600">VRBO Bookings</div>
              </div>
            </div>
          </div>
        </div>

        {/* Apartment Statistics */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Reservations by Apartment</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(apartmentStats).map(([apartment, stats]) => (
              <div key={apartment} className="bg-white rounded-lg shadow p-4">
                <h3 className="font-semibold text-gray-900 mb-2 text-sm">
                  {apartment.replace(/,.*/, '')}
                </h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Total:</span>
                    <span className="font-medium">{stats.total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-purple-600">Airbnb:</span>
                    <span className="font-medium text-purple-600">{stats.airbnb}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-600">VRBO:</span>
                    <span className="font-medium text-green-600">{stats.vrbo}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Reservations Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-2xl font-semibold text-gray-900">All October 2025 Reservations</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Guest
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Apartment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Check-in
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Check-out
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nights
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reservations
                  .sort((a, b) => a.DateArrival.getTime() - b.DateArrival.getTime())
                  .map((reservation) => (
                    <tr key={reservation.Id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {reservation.Name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span 
                          className="inline-flex px-2 py-1 text-xs font-semibold rounded-full text-white"
                          style={{ backgroundColor: getSourceColor(reservation.Source) }}
                        >
                          {reservation.Source}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {reservation.HouseName.replace(/,.*/, '')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {reservation.DateArrival.toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {reservation.DateDeparture.toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {reservation.Nights}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
