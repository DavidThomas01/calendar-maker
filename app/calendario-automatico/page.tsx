'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, AlertTriangle, CheckCircle, Download, ArrowLeft, Key, Building2 } from 'lucide-react';
import Link from 'next/link';
import CalendarDisplay from '@/components/CalendarDisplay';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import JSZip from 'jszip';
import { 
  generateApartmentCalendar,
  getMonthName
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

  // Automatically test API connection on component mount
  useEffect(() => {
    handleApiKeySubmit();
  }, []);

  const handleApiKeySubmit = async () => {
    setIsLoading(true);
    setError('');

    try {
      // Test API key by making a simple reservations request for current date
      const testDate = new Date().toISOString().split('T')[0];
      const response = await fetch(`/api/lodgify/reservations?startDate=${testDate}&endDate=${testDate}&page=1&limit=1`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error del servidor: ${response.status}`);
      }

      // API key is valid, fetch a sample of reservations to get property IDs
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      const startDate = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`;
      const endDate = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];
      
      const sampleResponse = await fetch(`/api/lodgify/reservations?startDate=${startDate}&endDate=${endDate}&page=1&limit=100`);

      if (!sampleResponse.ok) {
        const errorData = await sampleResponse.json();
        throw new Error(errorData.error || `Error del servidor: ${sampleResponse.status}`);
      }

      const sampleData = await sampleResponse.json();
      const sampleReservations: LodgifyReservation[] = sampleData.items || [];
      
      // Get properties with active reservations
      const propertiesWithData = new Set<number>();
      sampleReservations.forEach(res => {
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
      setSelectedProperties(propertiesData.length === 1 ? [propertiesData[0].id] : []);

      // Log detailed info about properties
      console.log('🏠 Propiedades encontradas:');
      console.log(`📊 Total: ${propertiesData.length - 1} propiedades (excluyendo "Todas las Propiedades")`);
      console.log(`✅ Con datos: ${propertiesWithData.size} propiedades`);
      console.log(`❌ Sin datos: ${propertyNames.size - propertiesWithData.size} propiedades`);
      
      propertiesWithData.forEach(id => {
        console.log(`✅ ${id}: ${propertyNames.get(id)}`);
      });
      
      Array.from(propertyNames.keys()).filter(id => !propertiesWithData.has(id)).forEach(id => {
        console.log(`❌ ${id}: ${propertyNames.get(id)} (Sin datos en API)`);
      });
      
    } catch (err) {
      setError(`Error conectando con Lodgify: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setIsLoading(false);
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

  const convertLodgifyToReservation = (lodgifyRes: LodgifyReservation, propertyName: string): Reservation => {
    // Calculate nights from arrival and departure dates
    const arrivalDate = new Date(lodgifyRes.arrival);
    const departureDate = new Date(lodgifyRes.departure);
    const nights = Math.ceil((departureDate.getTime() - arrivalDate.getTime()) / (1000 * 3600 * 24));
    
    // Calculate total people from rooms
    const totalPeople = lodgifyRes.rooms.reduce((total, room) => {
      return total + (room.people || room.guest_breakdown.adults + room.guest_breakdown.children);
    }, 0);

    // Map Lodgify source values to expected color system values
    const mapSource = (lodgifySource: string): string => {
      if (lodgifySource.toLowerCase().includes('airbnb')) return 'Airbnb';
      if (lodgifySource.toLowerCase().includes('vrbo') || lodgifySource.toLowerCase().includes('homeaway')) return 'VRBO';
      if (lodgifySource.toLowerCase().includes('website') || lodgifySource.toLowerCase().includes('direct')) return 'Website';
      return 'Website'; // Default fallback
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

    setIsGenerating(true);
    setError('');

    try {
      const startDate = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-01`;
      const endDate = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0]; // Last day of month

      const allReservations: Reservation[] = [];

      // Check if "all properties" is selected (propertyId 0)
      const fetchAllProperties = selectedProperties.includes(0);
      
      if (fetchAllProperties) {
        // Fetch all reservations for the month
        const response = await fetch(`/api/lodgify/reservations?startDate=${startDate}&endDate=${endDate}&page=1&limit=100`);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Error obteniendo reservas: ${response.status}`);
        }

        const reservationsResponse = await response.json();
        const reservationsData: LodgifyReservation[] = reservationsResponse.items || [];
        
        const processedReservations = reservationsData.map(res => 
          convertLodgifyToReservation(res, propertyNames.get(res.property_id) || `Propiedad ${res.property_id}`)
        );
        
        allReservations.push(...processedReservations);
      } else {
        // Fetch reservations for specific selected properties
        for (const propertyId of selectedProperties) {
          const response = await fetch(`/api/lodgify/reservations?startDate=${startDate}&endDate=${endDate}&page=1&limit=100`);

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Error obteniendo reservas: ${response.status}`);
          }

          const reservationsResponse = await response.json();
          const reservationsData: LodgifyReservation[] = reservationsResponse.items || [];
          const propertyReservations = reservationsData
            .filter(res => res.property_id === propertyId)
            .map(res => convertLodgifyToReservation(res, propertyNames.get(propertyId) || `Propiedad ${propertyId}`));
          
          allReservations.push(...propertyReservations);
        }
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
          
          // Download single PDF
          const cleanApartmentName = calendars[0].apartmentName.replace(/[^a-z0-9]/gi, '_');
          const fileName = `${cleanApartmentName}_${getMonthName(selectedMonth)}_${selectedYear}.pdf`;
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
          
          // Clean apartment name for filename
          const cleanApartmentName = calendar.apartmentName.replace(/[^a-z0-9]/gi, '_');
          const fileName = `${cleanApartmentName}_${getMonthName(selectedMonth)}_${selectedYear}.pdf`;
          
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

  const getYearOptions = (): number[] => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
  };

  const getMonthOptions = (): { value: number; label: string }[] => {
    return Array.from({ length: 12 }, (_, i) => ({
      value: i + 1,
      label: getMonthName(i + 1)
    }));
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
              <p className="text-lg text-gray-600">Conectando con Lodgify API...</p>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-600">Estableciendo conexión automática con Lodgify...</p>
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
              Conexión exitosa con Lodgify
            </p>
          </div>
          <div className="text-sm text-green-700 ml-7">
            <p>📊 Total: {properties.length - 1} propiedades encontradas</p>
            <p>✅ Con datos disponibles: {properties.filter(p => p.id !== 0 && !p.name.includes('Sin datos')).length} propiedades</p>
            <p>❌ Sin datos en API: {properties.filter(p => p.name.includes('Sin datos')).length} propiedades</p>
            <p className="mt-1 text-xs opacity-75">
              Las propiedades sin datos pueden tener reservas en otros sistemas o estar inactivas.
            </p>
          </div>
        </div>
      )}

      {/* Step 2: Property Selection */}
      {isApiKeySet && (
        <div className="mb-8 p-6 bg-white rounded-lg border border-gray-200">
          <div className="flex items-center mb-4">
            <Building2 className="h-6 w-6 text-green-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">Paso 2: Seleccionar Propiedades</h2>
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
                Año
              </label>
              <select
                id="year"
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {getYearOptions().map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            {/* Month Selection */}
            <div>
              <label htmlFor="month" className="block text-sm font-medium text-gray-700 mb-2">
                Mes
              </label>
              <select
                id="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {getMonthOptions().map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={generateCalendars}
            disabled={isGenerating}
            className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isGenerating ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Obteniendo Reservas y Generando Calendarios...
              </div>
            ) : (
              'Generar Calendarios Automáticamente'
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
        <p>Creador de Calendarios - Conecta directamente con Lodgify para obtener datos en tiempo real</p>
      </div>
    </div>
  );
} 