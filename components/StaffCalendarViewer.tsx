'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, ChevronDown, ChevronRight, LogOut, Users, Home, X, User, Mail, Clock } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { Reservation, ApartmentCalendar } from '@/lib/types';
import { parseCSVToReservations, filterReservationsForMonth, generateApartmentCalendar, groupReservationsByApartment, getMonthName, generateCleanDisplayName, getBookingColor } from '@/lib/calendar-utils';

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

// Property mapping (same as in calendario-automatico)
const PROPERTY_NAMES = new Map([
  [685237, 'At Home in Madrid I'],
  [685238, 'At Home in Madrid II'],
  [685239, 'At Home in Madrid III'],
  [685240, 'At Home in Madrid IV'],
  [685241, 'At Home in Madrid V'],
  [685242, 'At Home in Madrid VI'],
  [685243, 'At Home in Madrid VII'],
  [685244, 'At Home in Madrid VIII'],
  [685245, 'At Home in Madrid IX'],
  [685246, 'At Home in Madrid X']
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
      Status: lodgifyRes.status === 'Booked' ? 'Booked' : lodgifyRes.status,
      Email: lodgifyRes.guest?.email || '',
      Phone: lodgifyRes.guest?.phone || '',
      CountryName: ''
    };
  };

  const fetchCalendars = async () => {
    setIsLoading(true);
    setError('');
    setHasSearched(true);
    
    try {
      // Calculate date range for the selected month
      const startDate = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-01`;
      const endDate = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0];
      
      console.log(`📅 Staff Calendar: Fetching reservations for ${getMonthName(selectedMonth)} ${selectedYear}`);
      
      // Fetch data from Lodgify API (same endpoint as calendario-automatico)
      const response = await fetch(`/api/lodgify/reservations?startDate=${startDate}&endDate=${endDate}`);
      if (!response.ok) {
        throw new Error('Error al obtener las reservas');
      }
      
      const reservationsResponse = await response.json();
      const lodgifyReservations: LodgifyReservation[] = reservationsResponse.items || [];
      
      console.log(`📊 Staff Calendar: Found ${lodgifyReservations.length} reservations from Lodgify`);
      
      // Convert Lodgify data to internal Reservation format
      const allReservations: Reservation[] = lodgifyReservations.map(lodgifyRes => {
        const propertyName = PROPERTY_NAMES.get(lodgifyRes.property_id) || `Propiedad ${lodgifyRes.property_id}`;
        return convertLodgifyToReservation(lodgifyRes, propertyName);
      });
      
      // Filter reservations for selected month (using existing utility)
      const monthReservations = filterReservationsForMonth(allReservations, selectedYear, selectedMonth);
      
      // Group by apartment (using existing utility)
      const apartmentGroups = groupReservationsByApartment(monthReservations);
      
      // Generate calendars for each apartment (using existing utility)
      const apartmentCalendars: ApartmentCalendar[] = [];
      apartmentGroups.forEach((reservations, apartmentName) => {
        const calendar = generateApartmentCalendar(apartmentName, reservations, selectedYear, selectedMonth);
        apartmentCalendars.push(calendar);
      });
      
      // Sort calendars by apartment name for consistency
      apartmentCalendars.sort((a, b) => a.apartmentName.localeCompare(b.apartmentName));
      
      setCalendars(apartmentCalendars);
      console.log(`✅ Staff Calendar: Generated ${apartmentCalendars.length} calendars`);
      
    } catch (err) {
      console.error('Error:', err);
      setError('No se pudieron cargar los calendarios. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  // Remove the useEffect that was automatically fetching data

  const toggleCalendar = (apartmentName: string) => {
    setOpenCalendar(openCalendar === apartmentName ? null : apartmentName);
  };

  const handleReservationClick = (reservation: Reservation) => {
    setSelectedReservation(reservation);
    setShowReservationModal(true);
  };

  const closeReservationModal = () => {
    setShowReservationModal(false);
    setSelectedReservation(null);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Compact for mobile */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Calendar className="h-6 w-6 text-blue-600 mr-2" />
              <h1 className="text-lg font-bold text-gray-900">Calendarios</h1>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg"
            >
              <LogOut className="h-4 w-4 mr-1" />
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* Month/Year Selector */}
      <div className="bg-white border-b px-4 py-4">
        <div className="flex flex-col space-y-4">
          <div className="flex space-x-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Mes</label>
              <select
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(parseInt(e.target.value));
                  setCalendars([]); // Clear previous results
                  setHasSearched(false);
                }}
                className="w-full px-3 py-3 border border-gray-300 rounded-lg text-lg font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {months.map((month, index) => (
                  <option key={index} value={index + 1}>
                    {month}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Año</label>
              <select
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(parseInt(e.target.value));
                  setCalendars([]); // Clear previous results
                  setHasSearched(false);
                }}
                className="w-full px-3 py-3 border border-gray-300 rounded-lg text-lg font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Search Button */}
          <button
            onClick={fetchCalendars}
            disabled={isLoading}
            className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Cargando...
              </>
            ) : (
              <>
                <Calendar className="h-5 w-5 mr-2" />
                Ver Calendarios
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="px-4 py-4">
        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-700 text-center">{error}</p>
            <button
              onClick={fetchCalendars}
              className="w-full mt-3 px-4 py-2 bg-red-600 text-white rounded-lg"
            >
              Intentar de nuevo
            </button>
          </div>
        )}

        {/* Calendar List */}
        {hasSearched && !isLoading && !error && (
          <>
            {/* Summary */}
            <div className="mb-4 text-center">
              <h2 className="text-xl font-bold text-gray-900 mb-1">
                {getMonthName(selectedMonth)} {selectedYear}
              </h2>
              <p className="text-gray-600">
                {calendars.length} {calendars.length === 1 ? 'propiedad' : 'propiedades'}
              </p>
            </div>

            {/* Property Calendars */}
            <div className="space-y-3">
              {calendars.map((calendar) => (
                <div
                  key={calendar.apartmentName}
                  className="bg-white rounded-lg shadow-sm border overflow-hidden"
                >
                  {/* Apartment Header - Clickable */}
                  <button
                    onClick={() => toggleCalendar(calendar.apartmentName)}
                    className="w-full px-4 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center">
                      <Home className="h-5 w-5 text-blue-600 mr-3" />
                      <div className="text-left">
                        <h3 className="font-semibold text-gray-900 text-base">
                          {generateCleanDisplayName(calendar.apartmentName)}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {calendar.totalBookings} {calendar.totalBookings === 1 ? 'reserva' : 'reservas'}
                        </p>
                      </div>
                    </div>
                    {openCalendar === calendar.apartmentName ? (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    )}
                  </button>

                  {/* Calendar Content - Collapsible */}
                  {openCalendar === calendar.apartmentName && (
                    <div className="p-4">
                      {/* Calendar Grid */}
                      <div className="space-y-1">
                        {/* Days of week header */}
                        <div className="grid grid-cols-7 gap-1 mb-2">
                          {['D', 'L', 'M', 'X', 'J', 'V', 'S'].map((day) => (
                            <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                              {day}
                            </div>
                          ))}
                        </div>

                        {/* Calendar weeks */}
                        {calendar.weeks.map((week, weekIndex) => (
                          <div key={weekIndex} className="grid grid-cols-7 gap-1">
                            {week.days.map((day, dayIndex) => (
                              <div
                                key={dayIndex}
                                className={`
                                  min-h-[60px] p-1 border rounded text-xs
                                  ${day.isCurrentMonth 
                                    ? 'bg-white border-gray-200' 
                                    : 'bg-gray-50 border-gray-100 text-gray-400'
                                  }
                                `}
                              >
                                <div className="font-medium mb-1">
                                  {day.date.getDate()}
                                </div>
                                
                                {/* Reservations */}
                                <div className="space-y-1">
                                  {day.reservations.map((resInfo, index) => (
                                    <button
                                      key={index}
                                      onClick={() => handleReservationClick(resInfo.reservation)}
                                      className="w-full text-xs px-1 py-0.5 rounded text-white overflow-hidden hover:opacity-80 transition-opacity"
                                      style={{ 
                                        backgroundColor: getBookingColor(resInfo.reservation.Source, resInfo.reservation.Id.toString())
                                      }}
                                    >
                                      <div className="flex items-center">
                                        {resInfo.isCheckin && <span className="text-[10px] mr-1">✓</span>}
                                        {resInfo.isCheckout && <span className="text-[10px] mr-1">✗</span>}
                                        <span className="truncate">
                                          {resInfo.reservation.Name.split(' ')[0]}
                                        </span>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>

                      {/* Legend */}
                      <div className="mt-4 pt-3 border-t border-gray-200">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Leyenda:</h4>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex items-center">
                            <span className="text-green-600 mr-1">✓</span>
                            <span className="text-gray-600">Entrada</span>
                          </div>
                          <div className="flex items-center">
                            <span className="text-red-600 mr-1">✗</span>
                            <span className="text-gray-600">Salida</span>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Toca el nombre para ver más información
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {calendars.length === 0 && (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 text-lg">No hay reservas para este mes</p>
              </div>
            )}
          </>
        )}

        {!hasSearched && !isLoading && (
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 text-lg">Selecciona un mes y año, y haz clic en "Ver Calendarios"</p>
          </div>
        )}
      </main>

      {/* Reservation Details Modal */}
      {showReservationModal && selectedReservation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                Información de Reserva
              </h3>
              <button
                onClick={closeReservationModal}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 space-y-4">
              {/* Guest Info */}
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="flex items-center mb-2">
                  <User className="h-4 w-4 text-blue-600 mr-2" />
                  <span className="font-medium text-blue-900">Huésped</span>
                </div>
                <p className="text-lg font-semibold text-gray-900">{selectedReservation.Name}</p>
                <p className="text-sm text-gray-600">ID: {selectedReservation.Id}</p>
              </div>

              {/* Contact Info - Only show email */}
              {selectedReservation.Email && (
                <div className="space-y-2">
                  <div className="flex items-center">
                    <Mail className="h-4 w-4 text-gray-500 mr-2" />
                    <span className="text-sm text-gray-700">{selectedReservation.Email}</span>
                  </div>
                </div>
              )}

              {/* Stay Details */}
              <div className="bg-gray-50 rounded-lg p-3">
                <h4 className="font-medium text-gray-900 mb-3">Detalles de la Estancia</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Entrada:</span>
                    <span className="font-medium">{formatDate(selectedReservation.DateArrival)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Salida:</span>
                    <span className="font-medium">{formatDate(selectedReservation.DateDeparture)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Noches:</span>
                    <span className="font-medium">{selectedReservation.Nights}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Personas:</span>
                    <span className="font-medium">{selectedReservation.People}</span>
                  </div>
                </div>
              </div>

              {/* Property Info */}
              <div className="bg-green-50 rounded-lg p-3">
                <div className="flex items-center mb-2">
                  <Home className="h-4 w-4 text-green-600 mr-2" />
                  <span className="font-medium text-green-900">Propiedad</span>
                </div>
                <p className="font-semibold text-gray-900">{generateCleanDisplayName(selectedReservation.HouseName)}</p>
              </div>

              {/* Booking Source */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Plataforma:</span>
                <div className="flex items-center">
                  <div 
                    className="w-3 h-3 rounded mr-2"
                    style={{ backgroundColor: getBookingColor(selectedReservation.Source, selectedReservation.Id) }}
                  ></div>
                  <span className="font-medium text-sm">{selectedReservation.Source}</span>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Estado:</span>
                <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                  {selectedReservation.Status}
                </span>
              </div>
            </div>

            {/* Modal Footer */}
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