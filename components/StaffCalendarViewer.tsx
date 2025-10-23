'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, ChevronDown, ChevronRight, LogOut, Users, Home, X, User, Mail, Clock, MessageSquare } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { Reservation, ApartmentCalendar, DayComment } from '@/lib/types';
import { parseCSVToReservations, filterReservationsForMonth, generateApartmentCalendar, groupReservationsByApartment, getMonthName, generateCleanDisplayName, getBookingColor, fetchVrboIcalReservations, mergeReservationsWithStaticCSV } from '@/lib/calendar-utils';
import DayComments from './DayComments';
import GeneralDayComments from './GeneralDayComments';

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
  const [selectedGeneralComment, setSelectedGeneralComment] = useState<{date: Date, comment: string} | null>(null);
  const [dayComments, setDayComments] = useState<Map<string, DayComment[]>>(new Map());
  const [showCommentsDropdown, setShowCommentsDropdown] = useState<string | null>(null);

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
      // Calculate expanded date range to capture reservations that span multiple months
      // Query from 2 months before to 2 months after to ensure we don't miss any overlapping reservations
      const queryStartDate = new Date(selectedYear, selectedMonth - 3, 1); // 2 months before + current month start
      const queryEndDate = new Date(selectedYear, selectedMonth + 1, 0); // 1 month after current month end
      
      const startDate = queryStartDate.toISOString().split('T')[0];
      const endDate = queryEndDate.toISOString().split('T')[0];
      
      console.log(`📅 Staff Calendar: Fetching reservations for ${getMonthName(selectedMonth)} ${selectedYear} (expanded range: ${startDate} to ${endDate})`);
      
      // Fetch data from Lodgify API with expanded date range
      const response = await fetch(`/api/lodgify/reservations?startDate=${startDate}&endDate=${endDate}`);
      if (!response.ok) {
        throw new Error('Error al obtener las reservas');
      }
      
      const reservationsResponse = await response.json();
      const lodgifyReservations: LodgifyReservation[] = reservationsResponse.items || [];
      
      console.log(`📊 Staff Calendar: Found ${lodgifyReservations.length} reservations from Lodgify`);
      
      // Convert Lodgify data to internal Reservation format
      const lodgifyReservationsConverted: Reservation[] = lodgifyReservations.map(lodgifyRes => {
        const propertyName = PROPERTY_NAMES.get(lodgifyRes.property_id) || `Propiedad ${lodgifyRes.property_id}`;
        return convertLodgifyToReservation(lodgifyRes, propertyName);
      });

      // Fetch VRBO ICAL reservations and combine with Lodgify
      let allReservations: Reservation[] = [...lodgifyReservationsConverted];
      try {
        console.log('🔄 Staff Calendar: Fetching VRBO ICAL reservations...');
        const vrboReservations = await fetchVrboIcalReservations(); // Fetch all VRBO reservations
        if (vrboReservations.length > 0) {
          console.log(`📊 Staff Calendar: Adding ${vrboReservations.length} VRBO reservations`);
          allReservations.push(...vrboReservations);
        }
      } catch (error) {
        console.error('❌ Staff Calendar: Error fetching VRBO reservations:', error);
      }

      // Merge with static CSV reservations (October 2025 and November 2025)
      try {
        console.log('🔄 Staff Calendar: Merging static CSV reservations...');
        allReservations = await mergeReservationsWithStaticCSV(allReservations, ['october_2025_reservations.csv', 'november_2025_airbnb_reservations.csv']);
        console.log(`📊 Staff Calendar: Total reservations after merging: ${allReservations.length}`);
      } catch (error) {
        console.error('❌ Staff Calendar: Error merging static CSV reservations:', error);
      }
      
      // Filter reservations for selected month (using existing utility)
      const monthReservations = filterReservationsForMonth(allReservations, selectedYear, selectedMonth);
      
      // Group by apartment (using existing utility)
      const apartmentGroups = groupReservationsByApartment(monthReservations);
      
      // Generate calendars for each apartment (using existing utility) - now with comments loaded
      const apartmentCalendars: ApartmentCalendar[] = [];
      for (const [apartmentName, reservations] of apartmentGroups) {
        const calendar = await generateApartmentCalendar(apartmentName, reservations, selectedYear, selectedMonth);
        

        apartmentCalendars.push(calendar);
      }
      
      // Sort calendars by apartment name for consistency
      apartmentCalendars.sort((a, b) => a.apartmentName.localeCompare(b.apartmentName));
      
      setCalendars(apartmentCalendars);
      console.log(`✅ Staff Calendar: Generated ${apartmentCalendars.length} calendars with comments`);
      
      // Fetch general comments for all apartments in this month (same as detailed calendar)
      await fetchAllDayComments(selectedYear, selectedMonth);
      console.log(`✅ Staff Calendar: Fetched general comments for ${getMonthName(selectedMonth)} ${selectedYear}`);
      
    } catch (err) {
      console.error('Error:', err);
      setError('No se pudieron cargar los calendarios. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };



  // Check if a day has reservation comments
  const dayHasReservationComments = (day: any): boolean => {
    return day.reservations.some((resInfo: any) => {
      return resInfo.comments && resInfo.comments.length > 0;
    });
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



  const closeGeneralCommentModal = () => {
    setSelectedGeneralComment(null);
  };

  // Fetch day comments exactly like detailed calendar
  const fetchAllDayComments = async (year: number, month: number) => {
    try {
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 0);
      
      // Generate all possible day booking IDs for this month and all apartments
      const dayBookingIds: string[] = [];
      const apartmentNames = Array.from(PROPERTY_NAMES.values());
      
      apartmentNames.forEach(apartmentName => {
        const currentDate = new Date(monthStart);
        while (currentDate <= monthEnd) {
          const dayBookingId = generateDayBookingId(currentDate, apartmentName);
          dayBookingIds.push(dayBookingId);
          currentDate.setDate(currentDate.getDate() + 1);
        }
      });
      
      console.log(`🔍 Fetching general comments for ${dayBookingIds.length} day combinations`);
      
      // Break into smaller chunks to avoid URL length limit (431 error)
      const chunkSize = 50;
      const allComments: any[] = [];
      
      for (let i = 0; i < dayBookingIds.length; i += chunkSize) {
        const chunk = dayBookingIds.slice(i, i + chunkSize);
        console.log(`📡 Fetching chunk ${Math.floor(i/chunkSize) + 1}/${Math.ceil(dayBookingIds.length/chunkSize)} (${chunk.length} IDs)`);
        
        try {
          const response = await fetch(`/api/comments?bookingIds=${chunk.join('|')}`);
          if (!response.ok) {
            console.warn(`⚠️ Failed to fetch chunk ${Math.floor(i/chunkSize) + 1}: ${response.status}`);
            continue;
          }
          
          const data = await response.json();
          const comments = data.comments || [];
          allComments.push(...comments);
          console.log(`✅ Chunk ${Math.floor(i/chunkSize) + 1}: Found ${comments.length} comments`);
          
          // Small delay to avoid overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (chunkError) {
          console.warn(`⚠️ Error fetching chunk ${Math.floor(i/chunkSize) + 1}:`, chunkError);
        }
      }
      
      console.log(`📝 Total found ${allComments.length} general comments for the month`);
      
      // Create a map exactly like detailed calendar: bookingId -> DayComment[]
      const commentsMap = new Map<string, DayComment[]>();
      allComments.forEach((comment: any) => {
        if (comment.bookingId.startsWith('DAY_')) {
          const existingComments = commentsMap.get(comment.bookingId) || [];
          existingComments.push(comment);
          commentsMap.set(comment.bookingId, existingComments);
          console.log(`🟨 General comment: ${comment.date} for booking ${comment.bookingId} = "${comment.text}"`);
        }
      });
      
      setDayComments(commentsMap);
      console.log(`🗺️ DayComments Map has ${commentsMap.size} entries total`);
      
    } catch (error) {
      console.error('Error fetching general comments:', error);
    }
  };

  // Generate day booking ID for day-level comments (same as detailed calendar)
  const generateDayBookingId = (date: Date, apartmentName: string): string => {
    // Use local date formatting to avoid timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    return `DAY_${dateStr}_${apartmentName.replace(/\s+/g, '_')}`;
  };

  // Get day-level comments for a specific day (same as detailed calendar)
  const getDayLevelComments = (day: any, apartmentName: string): DayComment[] => {
    const dayBookingId = generateDayBookingId(day.date, apartmentName);
    return dayComments.get(dayBookingId) || [];
  };

  // Check specifically for general day comments (yellow comments) (same as detailed calendar)
  const dayHasGeneralComments = (day: any, apartmentName: string): boolean => {
    return getDayLevelComments(day, apartmentName).length > 0;
  };

  // Handle comment updates (read-only for staff)
  const handleCommentsUpdate = () => {
    // Staff can't edit comments - read only
  };

  // Get all yellow comments for a specific property in the current month
  const getPropertyMonthComments = (apartmentName: string): {date: Date, comment: string}[] => {
    const comments: {date: Date, comment: string}[] = [];
    
    // Iterate through all day comments to find ones for this apartment
    dayComments.forEach((commentArray, bookingId) => {
      if (bookingId.startsWith('DAY_') && bookingId.includes(apartmentName.replace(/\s+/g, '_'))) {
        // Extract date from booking ID: DAY_YYYY-MM-DD_apartment_name
        const datePart = bookingId.split('_')[1]; // Gets "YYYY-MM-DD"
        if (datePart) {
          const [year, month, day] = datePart.split('-');
          const commentDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          
          // Check if this date is in the selected month/year
          if (commentDate.getMonth() === selectedMonth - 1 && commentDate.getFullYear() === selectedYear) {
            commentArray.forEach(comment => {
              comments.push({
                date: commentDate,
                comment: comment.text
              });
            });
          }
        }
      }
    });
    
    // Sort comments by date
    return comments.sort((a, b) => a.date.getTime() - b.date.getTime());
  };

  // Toggle comments dropdown for a specific property
  const toggleCommentsDropdown = (apartmentName: string) => {
    setShowCommentsDropdown(showCommentsDropdown === apartmentName ? null : apartmentName);
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

  // Allow broader year selection for comprehensive reservation management
  const years = [2023, 2024, 2025, 2026, 2027];

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
                  <div className="bg-gray-50">
                    <button
                      onClick={() => toggleCalendar(calendar.apartmentName)}
                      className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-100 transition-colors"
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
                      <div className="flex items-center gap-2">
                        {openCalendar === calendar.apartmentName ? (
                          <ChevronDown className="h-5 w-5 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                    </button>


                  </div>

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

                        {/* Comments Summary Button - Below Legend */}
                        <div className="mb-3 flex justify-center">
                          <button
                            onClick={() => toggleCommentsDropdown(calendar.apartmentName)}
                            className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors shadow-sm"
                            title="Ver todos los comentarios generales"
                          >
                            <MessageSquare size={16} />
                            Ver Comentarios Generales
                          </button>
                        </div>

                        {/* Comments Dropdown - Below Button */}
                        {showCommentsDropdown === calendar.apartmentName && (
                          <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <h4 className="text-lg font-semibold text-yellow-800 mb-3 flex items-center gap-2">
                              <MessageSquare size={18} />
                              Comentarios Generales - {getMonthName(selectedMonth)} {selectedYear}
                            </h4>
                            {(() => {
                              const propertyComments = getPropertyMonthComments(calendar.apartmentName);
                              
                              if (propertyComments.length === 0) {
                                return (
                                  <div className="text-yellow-700 italic text-center py-2">
                                    No hay comentarios generales para este mes.
                                  </div>
                                );
                              }
                              
                              return (
                                <div className="space-y-3 max-h-64 overflow-y-auto">
                                  {propertyComments.map((item, index) => (
                                    <div 
                                      key={index} 
                                      className="bg-white rounded-lg p-3 border border-yellow-200 shadow-sm"
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1">
                                          <div className="font-medium text-yellow-800 mb-1">
                                            📅 {item.date.toLocaleDateString('es-ES', { 
                                              weekday: 'long', 
                                              day: 'numeric', 
                                              month: 'long' 
                                            })}
                                          </div>
                                          <div className="text-gray-700 text-sm leading-relaxed">
                                            💬 {item.comment}
                                          </div>
                                        </div>
                                        <div className="text-xs text-yellow-600 bg-yellow-100 px-2 py-1 rounded">
                                          Día {item.date.getDate()}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {/* Calendar weeks */}
                        {calendar.weeks.map((week, weekIndex) => (
                          <div key={weekIndex} className="grid grid-cols-7 gap-1">
                            {week.days.map((day, dayIndex) => {
                              const hasGeneralComments = dayHasGeneralComments(day, calendar.apartmentName);
                              
                              return (
                              <div
                                key={dayIndex}
                                className={`
                                  day-cell min-h-[100px] p-1 border rounded text-xs group relative
                                  ${hasGeneralComments 
                                    ? 'ring-4 ring-yellow-400 ring-inset bg-yellow-50' 
                                    : dayHasReservationComments(day) 
                                      ? 'bg-blue-50 border-blue-200' 
                                      : day.isCurrentMonth 
                                        ? 'bg-white border-gray-200' 
                                        : 'bg-gray-50 border-gray-100 text-gray-400'
                                  }
                                `}
                              >
                                <div className="font-medium mb-1">
                                  {day.date.getDate()}
                                </div>
                                
                                {/* Reservations */}
                                <div className="space-y-1 mb-2">
                                  {day.reservations.map((resInfo, index) => (
                                    <button
                                      key={index}
                                      onClick={(e) => {
                                        e.stopPropagation(); // Prevent day click
                                        handleReservationClick(resInfo.reservation);
                                      }}
                                      className="w-full text-base font-bold px-1 py-1 rounded text-white overflow-hidden hover:opacity-80 transition-opacity"
                                      style={{ 
                                        backgroundColor: getBookingColor(resInfo.reservation.Source, resInfo.reservation.Id.toString())
                                      }}
                                    >
                                      <div className="flex items-center">
                                        {resInfo.isCheckin && <span className="text-sm mr-1">✓</span>}
                                        {resInfo.isCheckout && <span className="text-sm mr-1">✗</span>}
                                        <span className="truncate">
                                          {resInfo.reservation.Name.split(' ')[0]}
                                        </span>
                                      </div>
                                    </button>
                                  ))}
                                </div>

                                {/* Day-Level Comments - Same as detailed calendar */}
                                <div className="mt-1">
                                  <GeneralDayComments
                                    key={`day-${day.date.toDateString()}`}
                                    date={day.date}
                                    apartmentName={calendar.apartmentName}
                                    comments={getDayLevelComments(day, calendar.apartmentName)}
                                    isOwner={false}
                                    onCommentsUpdate={handleCommentsUpdate}
                                  />
                                </div>
                              </div>
                            );
                            })}
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
            <p className="text-gray-600 text-lg">Selecciona un mes y año, y haz clic en &quot;Ver Calendarios&quot;</p>
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

              {/* Comments Section */}
              {(() => {
                // Find comments for this reservation from the calendar data (deduplicated)
                const commentsMap = new Map<string, DayComment>();
                calendars.forEach(calendar => {
                  calendar.weeks.forEach(week => {
                    week.days.forEach(day => {
                      day.reservations.forEach(resInfo => {
                        if (resInfo.reservation.Id === selectedReservation.Id && resInfo.comments) {
                          resInfo.comments.forEach(comment => {
                            // Use comment ID as key to avoid duplicates
                            commentsMap.set(comment.id, comment);
                          });
                        }
                      });
                    });
                  });
                });
                const reservationComments = Array.from(commentsMap.values());

                if (reservationComments.length > 0) {
                  return (
                    <div className="bg-blue-50 rounded-lg p-3">
                      <div className="flex items-center mb-2">
                        <MessageSquare className="h-4 w-4 text-blue-600 mr-2" />
                        <span className="font-medium text-blue-900">Comentarios</span>
                      </div>
                      <div className="space-y-2">
                        {reservationComments.map((comment) => (
                          <div key={comment.id} className="text-sm text-gray-700 bg-white p-2 rounded border">
                            <div className="font-medium text-xs text-gray-500 mb-1">
                              {new Date(comment.date).toLocaleDateString('es-ES')} - {comment.createdBy === 'owner' ? 'Propietario' : 'Staff'}
                            </div>
                            {comment.text}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
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

      {/* General Comment Modal */}
      {selectedGeneralComment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-bold text-yellow-700 flex items-center">
                  <span className="inline-block w-3 h-3 bg-yellow-400 rounded-full mr-2"></span>
                  Comentario General del Día
                </h3>
                <button
                  onClick={closeGeneralCommentModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="text-sm font-medium text-gray-700">Fecha:</span>
                  <span className="ml-2 text-sm text-gray-900">{formatDate(selectedGeneralComment.date)}</span>
                </div>
                
                <div className="mt-4">
                  <div className="text-sm text-gray-700 bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded">
                    {selectedGeneralComment.comment}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 