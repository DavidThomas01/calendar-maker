'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, ChevronDown, ChevronRight, LogOut, Users, Home, X, User, Mail, Clock } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { Reservation, ApartmentCalendar } from '@/lib/types';
import { parseCSVToReservations, filterReservationsForMonth, generateApartmentCalendar, groupReservationsByApartment, getMonthName, generateCleanDisplayName, getBookingColor, fetchVrboIcalReservations } from '@/lib/calendar-utils';

// Lodgify API response interface
interface LodgifyReservation {
  id: number;
  status: string;
  property_id: number;
  arrival: string;
  departure: string;
  guest?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  source?: string;
  total_amount?: number;
  currency_code?: string;
  created_at?: string;
  people_count?: number;
}

// Property mapping (CORRECTED to match calendario-automatico and CSV data)
const PROPERTY_NAMES = new Map([
  [685237, 'At Home in Madrid IX, Trendy Chueca, Prado, GranVia'],
  [685238, 'At Home in Madrid X, Center, Prado, Barrio Letras'],
  [685239, 'At Home in Madrid VIII, Centro, Prado, Letras'],
  [685240, 'At Home in Madrid VII, Trendy Neighborhood'],
  [685241, 'At Home in Madrid VI, Centro, Prado, Barrio Letras'],
  [685242, 'At Home in Madrid II, Centro, Prado, Barrio Letras'],
  [685243, 'At Home in Madrid I, Centro de Madrid'],
  [685244, 'At Home in Madrid III, Centro, Prado, BarrioLetras'],
  [685245, 'At Home in Madrid IV, Centro, Prado, Barrio Letras'],
  [685246, 'At Home in Madrid V, Centro, Prado, Barrio Letras']
]);

export default function StaffCalendarViewer() {
  const { logout } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [calendars, setCalendars] = useState<ApartmentCalendar[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [openCalendar, setOpenCalendar] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleLogout = () => {
    if (confirm('¿Cerrar sesión?')) {
      logout();
    }
  };

  // Convert Lodgify reservation to internal format (same logic as calendario-automatico)
  const convertLodgifyToReservation = (lodgifyRes: LodgifyReservation, propertyName: string): Reservation => {
    const arrivalDate = new Date(lodgifyRes.arrival);
    const departureDate = new Date(lodgifyRes.departure);
    const nights = Math.ceil((departureDate.getTime() - arrivalDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Map source values (same as calendario-automatico)
    const mapSource = (source: string): string => {
      const mapping: Record<string, string> = {
        'AirbnbIntegration': 'Airbnb',
        'BookingIntegration': 'Booking.com',
        'VrboIntegration': 'VRBO',
        'ExpediaIntegration': 'Expedia',
        'direct': 'Website',
        'manual': 'Website'
      };
      return mapping[source] || 'Website';
    };

    return {
      Id: lodgifyRes.id.toString(),
      Type: 'Booking',
      Source: mapSource(lodgifyRes.source || 'direct'),
      SourceText: '',
      Name: lodgifyRes.guest?.name || 'Sin nombre',
      DateArrival: arrivalDate,
      DateDeparture: departureDate,
      Nights: nights,
      HouseName: propertyName,
      InternalCode: '',
      House_Id: lodgifyRes.property_id.toString(),
      RoomTypes: '',
      People: lodgifyRes.people_count || 1,
      DateCreated: new Date(lodgifyRes.created_at || new Date()),
      TotalAmount: lodgifyRes.total_amount || 0,
      Currency: lodgifyRes.currency_code || 'EUR',
      Status: 'Booked',
      Email: lodgifyRes.guest?.email || '',
      Phone: lodgifyRes.guest?.phone || '',
      CountryName: ''
    };
  };

  const fetchLodgifyReservations = async (): Promise<Reservation[]> => {
    try {
      console.log('📡 Fetching Lodgify API reservations...');
      const response = await fetch('/api/lodgify/reservations');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      const allReservations: Reservation[] = [];
      
      if (data.reservations && Array.isArray(data.reservations)) {
        for (const lodgifyRes of data.reservations) {
          const propertyName = PROPERTY_NAMES.get(lodgifyRes.property_id);
          if (propertyName) {
            const reservation = convertLodgifyToReservation(lodgifyRes, propertyName);
            allReservations.push(reservation);
          }
        }
      }

      console.log(`✅ Fetched ${allReservations.length} reservations from Lodgify API`);
      return allReservations;
    } catch (error) {
      console.error('❌ Error fetching Lodgify reservations:', error);
      return [];
    }
  };

  // Generate calendars for the selected month
  const generateCalendars = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    setError('');
    setHasSearched(true);
    
    try {
      console.log(`🔄 Generating calendars for ${getMonthName(selectedMonth)} ${selectedYear}`);
      
      // Fetch from Lodgify API and VRBO ICAL
      const lodgifyReservations = await fetchLodgifyReservations();
      const vrboReservations = await fetchVrboIcalReservations();
      
      // Merge all reservations
      const allReservations = [...lodgifyReservations, ...vrboReservations];
      
      // Group by apartment
      const apartmentGroups = groupReservationsByApartment(allReservations);
      
      // Generate calendars
      const calendarPromises = Array.from(apartmentGroups.entries()).map(async ([apartmentName, reservations]) => {
        const filteredReservations = filterReservationsForMonth(reservations, selectedYear, selectedMonth);
        return generateApartmentCalendar(apartmentName, filteredReservations, selectedYear, selectedMonth);
      });
      
      const generatedCalendars = await Promise.all(calendarPromises);
      
      // Sort calendars by apartment name (Roman numeral order)
      const sortedCalendars = generatedCalendars.sort((a, b) => {
        const extractRoman = (name: string) => {
          const match = name.match(/At Home in Madrid (I{1,3}|IV|V|VI{1,3}|IX|X)/);
          return match ? match[1] : '';
        };
        
        const romanOrder = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
        const aRoman = extractRoman(a.apartmentName);
        const bRoman = extractRoman(b.apartmentName);
        
        return romanOrder.indexOf(aRoman) - romanOrder.indexOf(bRoman);
      });
      
      setCalendars(sortedCalendars);
      console.log(`✅ Generated ${sortedCalendars.length} calendars`);
      
    } catch (error) {
      console.error('❌ Error generating calendars:', error);
      setError(error instanceof Error ? error.message : 'Error generating calendars');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle month/year change
  const handleMonthChange = (delta: number) => {
    let newMonth = selectedMonth + delta;
    let newYear = selectedYear;
    
    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }
    
    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
  };

  const formatNights = (nights: number): string => {
    return nights === 1 ? '1 noche' : `${nights} noches`;
  };

  const toggleCalendar = (apartmentName: string) => {
    setOpenCalendar(openCalendar === apartmentName ? null : apartmentName);
  };

  const handleReservationClick = (reservation: Reservation) => {
    setSelectedReservation(reservation);
    setShowReservationModal(true);
  };

  const closeReservationModal = () => {
    setSelectedReservation(null);
    setShowReservationModal(false);
  };

  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 3 }, (_, i) => currentYear - 1 + i);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Vista de Staff</h1>
                <p className="text-sm text-gray-600">Calendario simplificado para el equipo</p>
              </div>
            </div>
            
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Controls */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Month/Year Selection */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => handleMonthChange(-1)}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={isLoading}
              >
                <ChevronDown className="h-5 w-5 rotate-90" />
              </button>
              
              <div className="flex gap-2">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isLoading}
                >
                  {months.map((month, index) => (
                    <option key={month} value={index + 1}>{month}</option>
                  ))}
                </select>
                
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isLoading}
                >
                  {years.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              
              <button
                onClick={() => handleMonthChange(1)}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={isLoading}
              >
                <ChevronDown className="h-5 w-5 -rotate-90" />
              </button>
            </div>

            {/* Generate Button */}
            <button
              onClick={generateCalendars}
              disabled={isLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Generando...
                </>
              ) : (
                <>
                  <Calendar className="h-4 w-4" />
                  Generar Calendarios
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800">{error}</p>
            </div>
          )}
        </div>

        {/* Calendars */}
        {hasSearched && calendars.length === 0 && !isLoading && (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay reservas</h3>
            <p className="text-gray-600">No se encontraron reservas para {getMonthName(selectedMonth)} {selectedYear}</p>
          </div>
        )}

        {calendars.length > 0 && (
          <div className="space-y-6">
            <div className="space-y-3">
              {calendars.map((calendar) => (
                <div
                  key={calendar.apartmentName}
                  className="bg-white rounded-lg shadow-sm overflow-hidden"
                >
                  {/* Calendar Header */}
                  <button
                    onClick={() => toggleCalendar(calendar.apartmentName)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center">
                      <Home className="h-5 w-5 text-blue-600 mr-3" />
                      <div className="text-left">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {generateCleanDisplayName(calendar.apartmentName)}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {calendar.totalBookings} reservas en {getMonthName(selectedMonth)} {selectedYear}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center">
                      <span className="text-sm text-gray-500 mr-2">
                        {openCalendar === calendar.apartmentName ? 'Ocultar' : 'Mostrar'}
                      </span>
                      {openCalendar === calendar.apartmentName ? (
                        <ChevronDown className="h-5 w-5 text-gray-500" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-500" />
                      )}
                    </div>
                  </button>

                  {/* Calendar Content */}
                  {openCalendar === calendar.apartmentName && (
                    <div className="px-6 pb-6">
                      {/* Calendar Grid */}
                      <div className="overflow-x-auto">
                        {/* Days of week header */}
                        <div className="grid grid-cols-7 gap-1 mb-2">
                          {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day) => (
                            <div key={day} className="p-2 text-center text-sm font-medium text-gray-700 bg-gray-100 rounded">
                              {day}
                            </div>
                          ))}
                        </div>

                        {/* Calendar weeks */}
                        {calendar.weeks.map((week, weekIndex) => (
                          <div key={weekIndex} className="grid grid-cols-7 gap-1">
                            {week.days.map((day, dayIndex) => {
                              return (
                                <div
                                  key={dayIndex}
                                  className={`
                                    min-h-24 p-2 border rounded text-sm
                                    ${day.isCurrentMonth ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'}
                                    ${day.reservations.length > 0 ? 'min-h-32' : ''}
                                  `}
                                >
                                  {/* Date */}
                                  <div className={`
                                    text-xs font-medium mb-1
                                    ${day.isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}
                                  `}>
                                    {day.date.getDate()}
                                  </div>

                                  {/* Reservations */}
                                  <div className="space-y-1">
                                    {day.reservations.map((resInfo, index) => {
                                      const color = getBookingColor(resInfo.reservation.Source, resInfo.reservation.Id);
                                      
                                      return (
                                        <div
                                          key={`${resInfo.reservation.Id}-${index}`}
                                          className="text-xs p-1 rounded cursor-pointer hover:opacity-80 transition-opacity"
                                          style={{ backgroundColor: color, color: 'white' }}
                                          onClick={() => handleReservationClick(resInfo.reservation)}
                                        >
                                          <div className="font-medium truncate">
                                            {resInfo.isCheckin ? '✈️' : resInfo.isCheckout ? '🛫' : '🏠'} {resInfo.reservation.Name}
                                          </div>
                                          {resInfo.isCheckin && (
                                            <div className="opacity-90 truncate">
                                              {formatNights(resInfo.reservation.Nights)} - {resInfo.reservation.Source}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>

                      {/* Legend */}
                      <div
                        className="mt-4 flex flex-wrap gap-4 text-xs text-gray-600"
                      >
                        <div className="flex items-center gap-1">
                          <span>✈️</span>
                          <span>Entrada</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span>🛫</span>
                          <span>Salida</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span>🏠</span>
                          <span>Estancia</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Reservation Modal */}
      {showReservationModal && selectedReservation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Detalles de la Reserva</h3>
              <button
                onClick={closeReservationModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Guest Info */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center mb-2">
                  <User className="h-4 w-4 text-gray-600 mr-2" />
                  <span className="font-medium text-gray-900">Huésped</span>
                </div>
                <div className="text-sm text-gray-700">
                  <div className="font-semibold">{selectedReservation.Name}</div>
                  <div className="flex items-center mt-1">
                    <Mail className="h-3 w-3 mr-1" />
                    {selectedReservation.Email}
                  </div>
                  {selectedReservation.Phone && (
                    <div className="mt-1">📞 {selectedReservation.Phone}</div>
                  )}
                  {selectedReservation.CountryName && (
                    <div className="mt-1">🌍 {selectedReservation.CountryName}</div>
                  )}
                  <div className="flex items-center mt-1">
                    <Users className="h-3 w-3 mr-1" />
                    {selectedReservation.People} {selectedReservation.People === 1 ? 'huésped' : 'huéspedes'}
                  </div>
                </div>
              </div>

              {/* Booking Details */}
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="flex items-center mb-2">
                  <Home className="h-4 w-4 text-blue-600 mr-2" />
                  <span className="font-medium text-blue-900">Detalles de la Reserva</span>
                </div>
                <div className="text-sm text-gray-700 space-y-1">
                  <div><span className="font-medium">ID:</span> {selectedReservation.Id}</div>
                  <div><span className="font-medium">Entrada:</span> {selectedReservation.DateArrival.toLocaleDateString('es-ES')}</div>
                  <div><span className="font-medium">Salida:</span> {selectedReservation.DateDeparture.toLocaleDateString('es-ES')}</div>
                  <div><span className="font-medium">Noches:</span> {selectedReservation.Nights}</div>
                  <div><span className="font-medium">Fuente:</span> {selectedReservation.Source}</div>
                  <div><span className="font-medium">Estado:</span> {selectedReservation.Status}</div>
                  <div><span className="font-medium">Total:</span> {selectedReservation.TotalAmount} {selectedReservation.Currency}</div>
                  <div className="flex items-center">
                    <Clock className="h-3 w-3 mr-1" />
                    <span className="font-medium">Creado:</span> {selectedReservation.DateCreated.toLocaleDateString('es-ES')}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t">
              <button
                onClick={closeReservationModal}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}