'use client';

import React, { useRef, useState } from 'react';
import { ApartmentCalendar, ReservationInfo } from '@/lib/types';
import { getBookingColor, getMonthName, getApartmentNumber, generateCalendarFilename, generateCleanDisplayName } from '@/lib/calendar-utils';
import { Download, X, User, Mail, Home } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useAuth } from './AuthProvider';

interface CalendarDisplayProps {
  calendar: ApartmentCalendar;
  onDownload?: () => void;
}

const CalendarDisplay: React.FC<CalendarDisplayProps> = ({ calendar, onDownload }) => {
  const calendarRef = useRef<HTMLDivElement>(null);
  const { userType } = useAuth();
  const [selectedReservation, setSelectedReservation] = useState<any | null>(null);

  const isOwner = userType === 'owner';

  // Helper function to format number of nights
  const formatNights = (nights: number): string => {
    return nights === 1 ? '1 noche' : `${nights} noches`;
  };

  // Helper function to get reservation info
  const getReservationInfo = (resInfo: ReservationInfo, dayKey: string): ReservationInfo => {
    return resInfo;
  };

  // Download handler
  const handleDownload = async () => {
    if (!calendarRef.current) return;

    try {
      // Create the PDF filename
      const filename = generateCalendarFilename(calendar.apartmentName, calendar.month, calendar.year);
      console.log(`📄 Generating PDF: ${filename}`);

      // Temporarily hide interactive elements
      const downloadButton = calendarRef.current.querySelector('.download-button') as HTMLElement;
      if (downloadButton) downloadButton.style.display = 'none';

      // Create canvas from the calendar
      const canvas = await html2canvas(calendarRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });

      // Restore interactive elements
      if (downloadButton) downloadButton.style.display = '';

      // Calculate PDF dimensions
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 295; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      if (imgHeight <= pageHeight) {
        // Single page
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight);
      } else {
        // Multiple pages
        let heightLeft = imgHeight;
        let position = 0;

        while (heightLeft > 0) {
          pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
          position = -pageHeight;
          
          if (heightLeft > 0) {
            pdf.addPage();
          }
        }
      }

      // Save the PDF
      pdf.save(filename);
      
      if (onDownload) onDownload();
      console.log(`✅ PDF downloaded: ${filename}`);
    } catch (error) {
      console.error('❌ Error generating PDF:', error);
    }
  };

  return (
    <div className="p-6">
      <div ref={calendarRef} className="bg-white">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {generateCleanDisplayName(calendar.apartmentName)}
            </h1>
            <h2 className="text-xl text-gray-700">
              {getMonthName(calendar.month)} {calendar.year}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Total reservas: {calendar.totalBookings}
            </p>
          </div>
          
          <button
            onClick={handleDownload}
            className="download-button flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            Descargar PDF
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="border border-gray-300 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-100">
                {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day) => (
                  <th key={day} className="p-2 text-center font-semibold text-gray-700 border-r border-gray-300 last:border-r-0">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {calendar.weeks.map((week, weekIndex) => (
                <tr key={weekIndex} className="min-h-32">
                  {week.days.map((day, dayIndex) => {
                    const checkins = day.reservations.filter(r => r.isCheckin);
                    const checkouts = day.reservations.filter(r => r.isCheckout);
                    const stays = day.reservations.filter(r => !r.isCheckin && !r.isCheckout);

                    return (
                      <td
                        key={dayIndex}
                        className={`
                          border-r border-b border-gray-300 last:border-r-0 last:border-b-0 p-1 align-top relative
                          ${day.isCurrentMonth ? 'bg-white' : 'bg-gray-50'}
                          ${day.reservations.length > 0 ? 'min-h-48' : 'min-h-32'}
                        `}
                        style={{ height: '300px', width: '14.28%' }}
                      >
                        {/* Date Number */}
                        <div className={`
                          text-sm font-semibold mb-1
                          ${day.isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}
                        `}>
                          {day.date.getDate()}
                        </div>

                        {/* Reservations */}
                        <div className="space-y-1">
                          {/* Check-ins */}
                          {checkins.map((resInfo, index) => {
                            const updatedResInfo = getReservationInfo(resInfo, day.date.toDateString());
                            const color = getBookingColor(resInfo.reservation.Source, resInfo.reservation.Id);
                            
                            return (
                              <div
                                key={`checkin-${resInfo.reservation.Id}-${index}`}
                                className="text-xs p-1 rounded cursor-pointer hover:opacity-80 transition-opacity"
                                style={{ backgroundColor: color, color: 'white' }}
                                onClick={() => setSelectedReservation({ reservation: resInfo.reservation, type: 'checkin', date: day.date })}
                              >
                                <div className="font-semibold truncate">
                                  ✈️ {resInfo.reservation.Name}
                                </div>
                                <div className="truncate opacity-90">
                                  {formatNights(resInfo.reservation.Nights)} - {resInfo.reservation.Source}
                                </div>
                              </div>
                            );
                          })}

                          {/* Check-outs */}
                          {checkouts.map((resInfo, index) => {
                            const color = getBookingColor(resInfo.reservation.Source, resInfo.reservation.Id);
                            
                            return (
                              <div
                                key={`checkout-${resInfo.reservation.Id}-${index}`}
                                className="text-xs p-1 rounded cursor-pointer hover:opacity-80 transition-opacity"
                                style={{ backgroundColor: color, color: 'white', opacity: 0.7 }}
                                onClick={() => setSelectedReservation({ reservation: resInfo.reservation, type: 'checkout', date: day.date })}
                              >
                                <div className="font-semibold truncate">
                                  🛫 Salida
                                </div>
                                <div className="truncate">
                                  {resInfo.reservation.Name}
                                </div>
                              </div>
                            );
                          })}

                          {/* Stays */}
                          {stays.map((resInfo, index) => {
                            const color = getBookingColor(resInfo.reservation.Source, resInfo.reservation.Id);
                            
                            return (
                              <div
                                key={`stay-${resInfo.reservation.Id}-${index}`}
                                className="text-xs p-1 rounded cursor-pointer hover:opacity-80 transition-opacity"
                                style={{ backgroundColor: color, color: 'white', opacity: 0.8 }}
                                onClick={() => setSelectedReservation({ reservation: resInfo.reservation, type: 'stay', date: day.date })}
                              >
                                <div className="font-semibold truncate">
                                  🏠 {resInfo.reservation.Name}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reservation Details Modal */}
      {selectedReservation && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setSelectedReservation(null)}
        >
          <div
            className="bg-white rounded-lg max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                Detalles de la Reserva
              </h3>
              <button
                onClick={() => setSelectedReservation(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 space-y-4">
              {/* Guest Info */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center mb-2">
                  <User className="h-4 w-4 text-gray-600 mr-2" />
                  <span className="font-medium text-gray-900">Huésped</span>
                </div>
                <div className="text-sm text-gray-700">
                  <div className="font-semibold">{selectedReservation.reservation.Name}</div>
                  <div className="flex items-center mt-1">
                    <Mail className="h-3 w-3 mr-1" />
                    {selectedReservation.reservation.Email}
                  </div>
                  {selectedReservation.reservation.Phone && (
                    <div className="mt-1">📞 {selectedReservation.reservation.Phone}</div>
                  )}
                  {selectedReservation.reservation.CountryName && (
                    <div className="mt-1">🌍 {selectedReservation.reservation.CountryName}</div>
                  )}
                </div>
              </div>

              {/* Booking Details */}
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="flex items-center mb-2">
                  <Home className="h-4 w-4 text-blue-600 mr-2" />
                  <span className="font-medium text-blue-900">Detalles de la Reserva</span>
                </div>
                <div className="text-sm text-gray-700 space-y-1">
                  <div><span className="font-medium">ID:</span> {selectedReservation.reservation.Id}</div>
                  <div><span className="font-medium">Entrada:</span> {selectedReservation.reservation.DateArrival.toLocaleDateString('es-ES')}</div>
                  <div><span className="font-medium">Salida:</span> {selectedReservation.reservation.DateDeparture.toLocaleDateString('es-ES')}</div>
                  <div><span className="font-medium">Noches:</span> {selectedReservation.reservation.Nights}</div>
                  <div><span className="font-medium">Huéspedes:</span> {selectedReservation.reservation.People}</div>
                  <div><span className="font-medium">Fuente:</span> {selectedReservation.reservation.Source}</div>
                  <div><span className="font-medium">Estado:</span> {selectedReservation.reservation.Status}</div>
                  <div><span className="font-medium">Total:</span> {selectedReservation.reservation.TotalAmount} {selectedReservation.reservation.Currency}</div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t">
              <button
                onClick={() => setSelectedReservation(null)}
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
};

export default CalendarDisplay;