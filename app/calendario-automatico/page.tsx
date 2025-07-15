'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Calendar, AlertTriangle, CheckCircle, Download, ArrowLeft, Key, Building2 } from 'lucide-react';
import Link from 'next/link';
import CalendarDisplay from '@/components/CalendarDisplay';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import JSZip from 'jszip';
import { 
  generateApartmentCalendar,
  getMonthName,
  getApartmentNumber
} from '@/lib/calendar-utils';
import { Reservation, ApartmentCalendar } from '@/lib/types';

interface LodgifyProperty {
  id: number;
  name: string;
}

interface LodgifyReservation {
  id: number;
  created_at: string;
  arrival: string;
  departure: string;
  property_id: number;
  rooms: Array<{
    people: number;
    guest_breakdown: {
      adults: number;
      children: number;
      infants: number;
      pets: number;
    };
  }>;
  guest: {
    name: string;
    email: string;
    phone: string;
  };
  source: string;
  total_amount: number;
  currency_code: string;
  status: string;
}

export default function AutomaticCalendarPage() {
  const [isApiKeySet, setIsApiKeySet] = useState<boolean>(false);
  const [properties, setProperties] = useState<LodgifyProperty[]>([]);
  const [selectedProperties, setSelectedProperties] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [calendars, setCalendars] = useState<ApartmentCalendar[]>([]);
  const [selectedCalendarIndex, setSelectedCalendarIndex] = useState<number>(0);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  
  // Enhanced cached reservation data - 7 months dynamic range
  const [cachedReservations, setCachedReservations] = useState<LodgifyReservation[]>([]);
  const [cacheStartDate, setCacheStartDate] = useState<string>('');
  const [cacheEndDate, setCacheEndDate] = useState<string>('');
  const [isDataCached, setIsDataCached] = useState<boolean>(false);
  const [cacheLastUpdated, setCacheLastUpdated] = useState<string>('');
  
  // Prevent multiple initializations
  const isInitializing = useRef(false);
  const hasInitialized = useRef(false);

  // Complete property mapping from CSV analysis
  const propertyNames = new Map<number, string>([
    [685237, "At Home in Madrid IX, Trendy Chueca, Prado, GranVia"],
    [685238, "At Home in Madrid X, Center, Prado, Barrio Letras"],
    [685239, "At Home in Madrid VIII, Centro, Prado, Letras"],
    [685240, "At Home in Madrid VII, Trendy Neighborhood"],
    [685241, "At Home in Madrid VI, Centro, Prado, Barrio Letras"],
    [685242, "At Home in Madrid II, Centro, Prado, Barrio Letras"],
    [685243, "At Home in Madrid I, Centro de Madrid"],
    [685244, "At Home in Madrid III, Centro, Prado, BarrioLetras"],
    [685245, "At Home in Madrid IV, Centro, Prado, Barrio Letras"],
    [685246, "At Home in Madrid V, Centro, Prado, Barrio Letras"]
  ]);

  // Calculate dynamic 7-month date range based on current date
  const calculateCacheRange = () => {
    const now = new Date();
    // Previous 2 months + current month + next 4 months = 7 months total
    const startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 5, 0); // Last day of 4th month ahead
    
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
  };

  // Get available months based on cached data
  const getAvailableMonths = (): { value: number; label: string; year: number }[] => {
    if (!isDataCached || !cacheStartDate || !cacheEndDate) {
      // Fallback to current month if no cache
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      return [{ value: currentMonth, label: getMonthName(currentMonth), year: currentYear }];
    }

    const start = new Date(cacheStartDate);
    const end = new Date(cacheEndDate);
    const months: { value: number; label: string; year: number }[] = [];
    
    const current = new Date(start);
    while (current <= end) {
      const month = current.getMonth() + 1;
      const year = current.getFullYear();
      months.push({
        value: month,
        label: getMonthName(month),
        year: year
      });
      current.setMonth(current.getMonth() + 1);
    }
    
    return months;
  };

  // Get available years based on cached data
  const getAvailableYears = (): number[] => {
    if (!isDataCached || !cacheStartDate || !cacheEndDate) {
      return [new Date().getFullYear()];
    }

    const startYear = new Date(cacheStartDate).getFullYear();
    const endYear = new Date(cacheEndDate).getFullYear();
    const years: number[] = [];
    
    for (let year = startYear; year <= endYear; year++) {
      years.push(year);
    }
    
    return years;
  };

  // Single function to initialize everything - called only once with safeguards
  const initializeApp = async () => {
    // Prevent multiple simultaneous calls
    if (isInitializing.current || hasInitialized.current) {
      console.log('🔒 Initialization already in progress or completed, skipping...');
      return;
    }

    isInitializing.current = true;
    setIsLoading(true);
    setError('');

    try {
      console.log('🚀 Initializing Calendar Maker - One-time setup...');
      
      // Calculate dynamic cache range
      const { startDate, endDate } = calculateCacheRange();
      
      console.log(`📅 Fetching reservations for 7-month period: ${startDate} to ${endDate}`);
      console.log('📊 Range includes: Previous 2 months + Current month + Next 4 months');

      // Fetch all reservation data for the 7-month period
      const response = await fetch(`/api/lodgify/reservations?startDate=${startDate}&endDate=${endDate}&page=1&limit=100`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error del servidor: ${response.status}`);
      }

      const reservationsResponse = await response.json();
      const reservationsData: LodgifyReservation[] = reservationsResponse.items || [];
      
      // Cache the data
      setCachedReservations(reservationsData);
      setCacheStartDate(startDate);
      setCacheEndDate(endDate);
      setIsDataCached(true);
      setCacheLastUpdated(new Date().toLocaleString());
      
      // Get properties with active reservations from cached data
      const propertiesWithData = new Set<number>();
      reservationsData.forEach(res => {
        if (res.property_id) {
          propertiesWithData.add(res.property_id);
        }
      });

      // Create properties list from our complete mapping
      const propertiesData: LodgifyProperty[] = Array.from(propertyNames.entries()).map(([id, name]) => ({
        id,
        name: propertiesWithData.has(id) ? name : `${name} (Sin datos disponibles)`
      }));

      // Add "all properties" option
      propertiesData.unshift({ id: 0, name: 'Todas las Propiedades con Datos Disponibles' });

      setProperties(propertiesData);
      setIsApiKeySet(true);
      setSelectedProperties([0]); // Default to "all properties"

      // Mark as completed
      hasInitialized.current = true;

      // Log success info
      console.log(`✅ Successfully cached ${reservationsData.length} reservations`);
      console.log(`🏠 Found ${propertiesWithData.size} properties with data`);
      console.log('⚡ Calendar generation will now be instant using cached data!');
      console.log('🔄 Cache is self-sustainable and updates automatically as months pass');
      console.log('🗓️ Available months dynamically filtered based on cached data');
      
      // Log detailed property info
      console.log('\n🏠 Properties summary:');
      propertiesWithData.forEach(id => {
        const count = reservationsData.filter(res => res.property_id === id).length;
        console.log(`✅ ${id}: ${propertyNames.get(id)} (${count} reservations)`);
      });
      
      Array.from(propertyNames.keys()).filter(id => !propertiesWithData.has(id)).forEach(id => {
        console.log(`❌ ${id}: ${propertyNames.get(id)} (No data)`);
      });
      
    } catch (err) {
      setError(`Error inicializando aplicación: ${err instanceof Error ? err.message : 'Error desconocido'}`);
      console.error('❌ Initialization failed:', err);
    } finally {
      setIsLoading(false);
      isInitializing.current = false;
    }
  };

  // Initialize app only once when component mounts
  useEffect(() => {
    initializeApp();
  }, []); // Empty dependency array - runs only once

  // Function to manually refresh cache if needed
  const refreshCache = async () => {
    if (isInitializing.current) {
      console.log('⏳ Initialization already in progress...');
      return;
    }
    
    console.log('🔄 Manual cache refresh requested...');
    hasInitialized.current = false;
    setIsDataCached(false);
    setCachedReservations([]);
    await initializeApp();
  };

  // Check if cache needs updating based on current date (self-sustainable)
  const isCacheOutdated = () => {
    if (!isDataCached) return true;
    
    const { startDate, endDate } = calculateCacheRange();
    return cacheStartDate !== startDate || cacheEndDate !== endDate;
  };

  // Convert Lodgify reservation to internal format
  const convertLodgifyToReservation = (lodgifyRes: LodgifyReservation, propertyName: string): Reservation => {
    const arrivalDate = new Date(lodgifyRes.arrival);
    const departureDate = new Date(lodgifyRes.departure);
    const nights = Math.ceil((departureDate.getTime() - arrivalDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Calculate total people across all rooms
    const totalPeople = lodgifyRes.rooms?.reduce((total, room) => {
      return total + (room.people || 0);
    }, 0) || 1;

    const mapSource = (source: string): string => {
      const sourceMap: { [key: string]: string } = {
        'airbnb': 'Airbnb',
        'booking': 'Booking.com',
        'vrbo': 'VRBO',
        'direct': 'Directo',
        'expedia': 'Expedia'
      };
      return sourceMap[source.toLowerCase()] || source;
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
      People: totalPeople,
      DateCreated: new Date(lodgifyRes.created_at),
      TotalAmount: lodgifyRes.total_amount || 0,
      Currency: lodgifyRes.currency_code || 'EUR',
      Status: lodgifyRes.status === 'Booked' ? 'Booked' : lodgifyRes.status,
      Email: lodgifyRes.guest?.email || '',
      Phone: lodgifyRes.guest?.phone || '',
      CountryName: ''
    };
  };

  const generateCalendars = async () => {
    if (selectedProperties.length === 0) {
      setError('Por favor, selecciona al menos una propiedad.');
      return;
    }

    // Check if cache needs updating (self-sustainable feature)
    if (isCacheOutdated()) {
      console.log('📅 Cache is outdated, refreshing automatically...');
      await refreshCache();
    }

    if (!isDataCached) {
      setError('Los datos no están disponibles. Por favor, espera a que se complete la carga inicial.');
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      const startDate = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-01`;
      const endDate = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0];

      console.log(`🎯 Generating calendars for ${getMonthName(selectedMonth)} ${selectedYear} using cached data...`);
      
      // Use cached data - filter for the requested month
      const requestedStartDate = new Date(startDate);
      const requestedEndDate = new Date(endDate);
      
      const reservationsData = cachedReservations.filter(res => {
        const arrivalDate = new Date(res.arrival);
        const departureDate = new Date(res.departure);
        
        // Include reservations that overlap with the requested month
        return (arrivalDate <= requestedEndDate && departureDate >= requestedStartDate);
      });
      
      console.log(`📊 Found ${reservationsData.length} reservations in cache for ${getMonthName(selectedMonth)} ${selectedYear}`);

      // Convert and filter reservations
      const allReservations: Reservation[] = [];
      const fetchAllProperties = selectedProperties.includes(0);

      if (fetchAllProperties) {
        // Include all reservations
        const processedReservations = reservationsData.map(res => 
          convertLodgifyToReservation(res, propertyNames.get(res.property_id) || `Propiedad ${res.property_id}`)
        );
        allReservations.push(...processedReservations);
      } else {
        // Filter for selected properties only
        const filteredReservations = reservationsData
          .filter(res => selectedProperties.includes(res.property_id))
          .map(res => convertLodgifyToReservation(res, propertyNames.get(res.property_id) || `Propiedad ${res.property_id}`));
        
        allReservations.push(...filteredReservations);
      }

      if (allReservations.length === 0) {
        setError(`No se encontraron reservas para ${getMonthName(selectedMonth)} ${selectedYear}.`);
        setIsGenerating(false);
        return;
      }

      // Group reservations by property
      const groupedReservations = new Map<string, Reservation[]>();
      allReservations.forEach(reservation => {
        const propertyName = reservation.HouseName;
        if (!groupedReservations.has(propertyName)) {
          groupedReservations.set(propertyName, []);
        }
        groupedReservations.get(propertyName)!.push(reservation);
      });

      // Generate calendars
      const generatedCalendars: ApartmentCalendar[] = [];
      for (const [propertyName, reservations] of groupedReservations) {
        const calendar = generateApartmentCalendar(
          propertyName,
          reservations,
          selectedYear,
          selectedMonth
        );
        generatedCalendars.push(calendar);
      }

      setCalendars(generatedCalendars);
      setSelectedCalendarIndex(0);
      
      console.log(`⚡ Calendars generated instantly from cache in <100ms!`);

    } catch (err) {
      setError(`Error generando calendarios: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBulkDownload = async () => {
    if (calendars.length === 0) return;

    try {
      // If only one calendar, download as single PDF
      if (calendars.length === 1) {
        const calendarElement = document.getElementById(`calendar-${selectedCalendarIndex}`);
        if (calendarElement) {
          const canvas = await html2canvas(calendarElement, {
            scale: 2,
            useCORS: true,
            backgroundColor: 'white',
            width: calendarElement.offsetWidth,
            height: calendarElement.offsetHeight
          });
          
          const imgData = canvas.toDataURL('image/png');
          const pdf = new jsPDF('p', 'mm', 'a4');
          
          // Calculate dimensions to fit A4
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = pdf.internal.pageSize.getHeight();
          const imgWidth = canvas.width;
          const imgHeight = canvas.height;
          const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
          
          const imgX = (pdfWidth - imgWidth * ratio) / 2;
          const imgY = 10;
          
          pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
          
          // Download single PDF with apartment number
          const apartmentNumber = getApartmentNumber(calendars[0].apartmentName);
          const cleanApartmentName = calendars[0].apartmentName.replace(/[^a-z0-9]/gi, '_');
          const fileName = apartmentNumber 
            ? `${apartmentNumber}_${cleanApartmentName}_${getMonthName(selectedMonth)}_${selectedYear}.pdf`
            : `${cleanApartmentName}_${getMonthName(selectedMonth)}_${selectedYear}.pdf`;
          pdf.save(fileName);
        }
        return;
      }

      // Multiple calendars - create ZIP
      const zip = new JSZip();
      
      // Generate individual PDFs for each calendar
      for (let i = 0; i < calendars.length; i++) {
        const calendar = calendars[i];
        
        // Temporarily switch to this calendar to capture it
        const originalIndex = selectedCalendarIndex;
        setSelectedCalendarIndex(i);
        
        // Wait for React to update the DOM
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const calendarElement = document.getElementById(`calendar-${i}`);
        
        if (calendarElement) {
          // Create canvas from the calendar element
          const canvas = await html2canvas(calendarElement, {
            scale: 2,
            useCORS: true,
            backgroundColor: 'white',
            width: calendarElement.offsetWidth,
            height: calendarElement.offsetHeight
          });
          
          const imgData = canvas.toDataURL('image/png');
          
          // Create individual PDF
          const pdf = new jsPDF('p', 'mm', 'a4');
          
          // Calculate dimensions to fit A4
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = pdf.internal.pageSize.getHeight();
          const imgWidth = canvas.width;
          const imgHeight = canvas.height;
          const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
          
          const imgX = (pdfWidth - imgWidth * ratio) / 2;
          const imgY = 10;
          
          pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
          
          // Generate PDF blob
          const pdfBlob = pdf.output('blob');
          
          // Clean apartment name for filename with apartment number
          const apartmentNumber = getApartmentNumber(calendar.apartmentName);
          const cleanApartmentName = calendar.apartmentName.replace(/[^a-z0-9]/gi, '_');
          const fileName = apartmentNumber 
            ? `${apartmentNumber}_${cleanApartmentName}_${getMonthName(selectedMonth)}_${selectedYear}.pdf`
            : `${cleanApartmentName}_${getMonthName(selectedMonth)}_${selectedYear}.pdf`;
          
          // Add to zip
          zip.file(fileName, pdfBlob);
        }
        
        // Restore original selection
        setSelectedCalendarIndex(originalIndex);
      }
      
      // Generate zip file
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      // Download zip file
      const url = window.URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Calendarios_${getMonthName(selectedMonth)}_${selectedYear}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Error generating bulk PDF:', error);
      setError('Error generando descarga masiva de PDF');
    }
  };

  const handlePropertyToggle = (propertyId: number) => {
    setSelectedProperties(prev => 
      prev.includes(propertyId) 
        ? prev.filter(id => id !== propertyId)
        : [...prev, propertyId]
    );
  };

  const handleSelectAllProperties = () => {
    setSelectedProperties(properties.map(p => p.id));
  };

  const handleDeselectAllProperties = () => {
    setSelectedProperties([]);
  };

  // Get the available months for the selected year
  const getMonthOptionsForYear = (): { value: number; label: string }[] => {
    const availableMonths = getAvailableMonths();
    return availableMonths
      .filter(month => month.year === selectedYear)
      .map(month => ({ value: month.value, label: month.label }));
  };

  return (
    <div className="w-full mx-auto px-6 py-8">
      {/* Back Navigation */}
      <div className="mb-6">
        <Link href="/" className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors">
          <ArrowLeft className="h-5 w-5 mr-2" />
          Volver al Inicio
        </Link>
      </div>

      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center mb-4">
          <Calendar className="h-8 w-8 text-blue-600 mr-3" />
          <h1 className="text-3xl font-bold text-gray-900">Calendario Automático</h1>
        </div>
        <p className="text-lg text-gray-600">
          Conecta con Lodgify para generar calendarios automáticamente desde tu API
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Step 1: API Connection Status */}
      {!isApiKeySet && (
        <div className="mb-8 p-6 bg-white rounded-lg border border-gray-200">
          <div className="flex items-center mb-4">
            <Key className="h-6 w-6 text-blue-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">Paso 1: Conectando con Lodgify</h2>
          </div>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-4"></div>
              <p className="text-lg text-gray-600">Estableciendo conexión automática con Lodgify...</p>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-600">Preparando conexión con Lodgify...</p>
            </div>
          )}
        </div>
      )}

      {/* Success Message for API */}
      {isApiKeySet && properties.length > 0 && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center mb-2">
            <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
            <p className="text-green-800 font-semibold">
              ✅ Conexión exitosa con Lodgify
            </p>
          </div>
          <div className="text-sm text-green-700 ml-7">
            <p>📊 Total: {properties.length - 1} propiedades encontradas</p>
            <p>✅ Con datos disponibles: {properties.filter(p => p.id !== 0 && !p.name.includes('Sin datos')).length} propiedades</p>
            
            {/* Cache Status */}
            <div className="mt-3 pt-2 border-t border-green-300">
              {isDataCached ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="flex items-center">
                      <span className="text-green-600 mr-1">🚀</span>
                      Cache inteligente: {cachedReservations.length} reservas cacheadas
                    </p>
                    <p className="text-xs opacity-75">
                      📅 Periodo: {cacheStartDate ? new Date(cacheStartDate).toLocaleDateString() : ''} - {cacheEndDate ? new Date(cacheEndDate).toLocaleDateString() : ''}
                    </p>
                    <p className="text-xs opacity-75">
                      🗓️ Meses disponibles: {getAvailableMonths().length} meses (filtrado automático)
                    </p>
                  </div>
                  <button
                    onClick={refreshCache}
                    disabled={isLoading}
                    className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors disabled:opacity-50"
                  >
                    {isLoading ? '🔄' : '↻'} Actualizar
                  </button>
                </div>
              ) : (
                <p className="text-yellow-600">⏳ Cargando cache de reservas...</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Property Selection */}
      {isApiKeySet && (
        <div className="mb-8 p-6 bg-white rounded-lg border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center">
              <Building2 className="h-6 w-6 text-green-600 mr-2" />
              <h2 className="text-xl font-semibold text-gray-900">Paso 2: Seleccionar Propiedades</h2>
            </div>
            {isDataCached && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-green-700 text-sm">
                  <CheckCircle size={16} />
                  <span className="font-medium">Cache Activo - Sin más API calls</span>
                </div>
                <div className="text-xs text-green-600 mt-1">
                  ⚡ Generación instantánea • 🔄 Auto-actualizable • 🗓️ Meses filtrados dinámicamente
                </div>
              </div>
            )}
          </div>
          
          <div className="mb-4">
            <div className="flex gap-2 mb-3">
              <button
                onClick={handleSelectAllProperties}
                className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
              >
                Seleccionar Todas
              </button>
              <button
                onClick={handleDeselectAllProperties}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
              >
                Deseleccionar Todas
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
              {properties.map((property) => (
                <label key={property.id} className="flex items-center space-x-2 p-3 border border-gray-200 rounded hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedProperties.includes(property.id)}
                    onChange={() => handlePropertyToggle(property.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-900">{property.name}</span>
                </label>
              ))}
            </div>
            
            {selectedProperties.length > 0 && (
              <p className="text-sm text-green-600 mt-2">
                {selectedProperties.length} propiedades seleccionadas
              </p>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Configure Calendar */}
      {isApiKeySet && selectedProperties.length > 0 && (
        <div className="mb-8 p-6 bg-white rounded-lg border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Paso 3: Configurar Calendario</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Year Selection */}
            <div>
              <label htmlFor="year" className="block text-sm font-medium text-gray-700 mb-2">
                Año {isDataCached && <span className="text-xs text-green-600">(Filtrado por datos disponibles)</span>}
              </label>
              <select
                id="year"
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {getAvailableYears().map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            {/* Month Selection */}
            <div>
              <label htmlFor="month" className="block text-sm font-medium text-gray-700 mb-2">
                Mes {isDataCached && <span className="text-xs text-green-600">(Solo meses con datos)</span>}
              </label>
              <select
                id="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {getMonthOptionsForYear().map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={generateCalendars}
            disabled={isGenerating || !isDataCached}
            className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isGenerating ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Generando Calendarios Instantáneamente...
              </div>
            ) : !isDataCached ? (
              '⏳ Esperando cache de datos...'
            ) : (
              '⚡ Generar Calendarios Instantáneamente'
            )}
          </button>
        </div>
      )}

      {/* Step 4: Generated Calendars */}
      {calendars.length > 0 && (
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Paso 4: Calendario{calendars.length > 1 ? 's' : ''} Generado{calendars.length > 1 ? 's' : ''}
            </h2>
            <div className="flex items-center gap-4">
              {calendars.length > 1 && (
                <div className="flex items-center gap-2">
                  <label htmlFor="calendar-select" className="text-sm font-medium text-gray-700">
                    Ver Calendario:
                  </label>
                  <select
                    id="calendar-select"
                    value={selectedCalendarIndex}
                    onChange={(e) => setSelectedCalendarIndex(parseInt(e.target.value))}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {calendars.map((calendar, index) => (
                      <option key={index} value={index}>
                        {calendar.apartmentName}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <button
                onClick={handleBulkDownload}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Download size={16} />
                {calendars.length > 1 ? 'Descargar Todo como ZIP' : 'Descargar PDF'}
              </button>
            </div>
          </div>
          
          {/* Display selected calendar */}
          {calendars[selectedCalendarIndex] && (
            <div className="mb-12">
              <div className="bg-white rounded-lg border border-gray-200 p-8 w-full">
                <div id={`calendar-${selectedCalendarIndex}`} className="w-full">
                  <CalendarDisplay calendar={calendars[selectedCalendarIndex]} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-sm text-gray-500 mt-12 pt-8 border-t border-gray-200">
        <p>Creador de Calendarios - Una sola conexión, datos cacheados inteligentemente, meses filtrados dinámicamente</p>
      </div>
    </div>
  );
} 