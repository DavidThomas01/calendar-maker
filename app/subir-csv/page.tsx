'use client';

import React, { useState } from 'react';
import { Calendar, AlertTriangle, CheckCircle, Download, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import FileUpload from '@/components/FileUpload';
import CalendarDisplay from '@/components/CalendarDisplay';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import JSZip from 'jszip';
import { 
  parseCSVToReservations, 
  filterReservationsForMonth, 
  generateApartmentCalendar,
  groupReservationsByApartment,
  getMonthName,
  generateCalendarFilename,
  generateCleanDisplayName,
  fetchVrboIcalReservations,
  mergeReservationsWithStaticCSV
} from '@/lib/calendar-utils';
import { Reservation, ApartmentCalendar } from '@/lib/types';

export default function CSVUploadPage() {
  const [csvData, setCsvData] = useState<any[] | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedApartment, setSelectedApartment] = useState<string>('');
  const [calendars, setCalendars] = useState<ApartmentCalendar[]>([]);
  const [selectedCalendarIndex, setSelectedCalendarIndex] = useState<number>(0);
  const [error, setError] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  const handleFileProcessed = (data: any[]) => {
    try {
      setError('');
      setCsvData(data);
      
      const parsedReservations = parseCSVToReservations(data);
      setReservations(parsedReservations);
      
      // Reset selection when new file is uploaded
      setSelectedApartment('');
      setCalendars([]);
      setSelectedCalendarIndex(0);
      
      console.log(`Processed ${parsedReservations.length} valid reservations`);
    } catch (err) {
      setError(`Error procesando archivo: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    }
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    setCsvData(null);
    setReservations([]);
    setCalendars([]);
    setSelectedCalendarIndex(0);
  };

  const generateCalendars = async () => {
    if (!reservations.length) {
      setError('Por favor, sube un archivo CSV primero.');
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      // Fetch VRBO ICAL reservations and combine with CSV reservations
      let allReservations = [...reservations];
      try {
        console.log('🔄 CSV Upload: Fetching VRBO ICAL reservations...');
        const vrboReservations = await fetchVrboIcalReservations(); // Fetch all VRBO reservations
        if (vrboReservations.length > 0) {
          console.log(`📊 CSV Upload: Adding ${vrboReservations.length} VRBO reservations`);
          allReservations.push(...vrboReservations);
        }
      } catch (error) {
        console.error('❌ CSV Upload: Error fetching VRBO reservations:', error);
      }

      // Merge with static CSV reservations (October 2025)
      try {
        console.log('🔄 CSV Upload: Merging static CSV reservations...');
        allReservations = await mergeReservationsWithStaticCSV(allReservations);
        console.log(`📊 CSV Upload: Total reservations after merging: ${allReservations.length}`);
      } catch (error) {
        console.error('❌ CSV Upload: Error merging static CSV reservations:', error);
      }

      // Filter reservations for the selected month
      const monthReservations = filterReservationsForMonth(allReservations, selectedYear, selectedMonth);
      
      if (monthReservations.length === 0) {
        setError(`No se encontraron reservas para ${getMonthName(selectedMonth)} ${selectedYear}.`);
        setIsGenerating(false);
        return;
      }

      // Group by apartment
      const apartmentGroups = groupReservationsByApartment(monthReservations);
      
      // Generate calendars for selected apartment or all apartments
      const generatedCalendars: ApartmentCalendar[] = [];
      
      if (selectedApartment) {
        // Generate for specific apartment
        const apartmentReservations = apartmentGroups.get(selectedApartment);
        if (apartmentReservations) {
          const calendar = await generateApartmentCalendar(
            selectedApartment,
            apartmentReservations,
            selectedYear,
            selectedMonth
          );
          generatedCalendars.push(calendar);
        }
      } else {
        // Generate for all apartments
        for (const [apartmentName, apartmentReservations] of apartmentGroups) {
          const calendar = await generateApartmentCalendar(
            apartmentName,
            apartmentReservations,
            selectedYear,
            selectedMonth
          );
          generatedCalendars.push(calendar);
        }
      }

      setCalendars(generatedCalendars);
      setSelectedCalendarIndex(0); // Reset to first calendar
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
          const fileName = generateCalendarFilename(calendars[0].apartmentName, selectedMonth, selectedYear);
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
          
          // Generate filename using new format
          const fileName = generateCalendarFilename(calendar.apartmentName, selectedMonth, selectedYear);
          
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

  const getUniqueApartments = (): string[] => {
    const apartments = new Set(reservations.map(r => r.HouseName));
    return Array.from(apartments).sort();
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
          <Calendar className="h-8 w-8 text-green-600 mr-3" />
          <h1 className="text-3xl font-bold text-gray-900">Subir Archivo CSV</h1>
        </div>
        <p className="text-lg text-gray-600">
          Genera hermosos calendarios de reservas desde tus datos CSV de Lodgify
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

      {/* Success Message */}
      {reservations.length > 0 && !error && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
            <p className="text-green-800">
              Se cargaron exitosamente {reservations.length} reservas de {getUniqueApartments().length} apartamentos
            </p>
          </div>
        </div>
      )}

      {/* Step 1: File Upload */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Paso 1: Subir Archivo CSV</h2>
        <FileUpload onFileProcessed={handleFileProcessed} onError={handleError} />
      </div>

      {/* Step 2: Configure Calendar */}
      {reservations.length > 0 && (
        <div className="mb-8 p-6 bg-white rounded-lg border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Paso 2: Configurar Calendario</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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

            {/* Apartment Selection */}
            <div>
              <label htmlFor="apartment" className="block text-sm font-medium text-gray-700 mb-2">
                Apartamento
              </label>
              <select
                id="apartment"
                value={selectedApartment}
                onChange={(e) => setSelectedApartment(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos los Apartamentos</option>
                {getUniqueApartments().map(apartment => (
                  <option key={apartment} value={apartment}>{generateCleanDisplayName(apartment)}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={generateCalendars}
            disabled={isGenerating}
            className="w-full px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isGenerating ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Generando Calendarios...
              </div>
            ) : (
              `Generar Calendario${selectedApartment ? '' : 's'}`
            )}
          </button>
        </div>
      )}

      {/* Step 3: Generated Calendars */}
      {calendars.length > 0 && (
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Paso 3: Calendario{calendars.length > 1 ? 's' : ''} Generado{calendars.length > 1 ? 's' : ''}
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
                        {generateCleanDisplayName(calendar.apartmentName)}
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
        <p>Creador de Calendarios - Genera hermosos calendarios de reservas para tus propiedades</p>
      </div>
    </div>
  );
} 