'use client';

import React, { useRef } from 'react';
import { ApartmentCalendar, ReservationInfo } from '@/lib/types';
import { getBookingColor, getMonthName, getApartmentNumber } from '@/lib/calendar-utils';
import { Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface CalendarDisplayProps {
  calendar: ApartmentCalendar;
  onDownload?: () => void;
}

const CalendarDisplay: React.FC<CalendarDisplayProps> = ({ calendar, onDownload }) => {
  const calendarRef = useRef<HTMLDivElement>(null);



  const handleDownload = async () => {
    if (onDownload) {
      onDownload();
      return;
    }
    
    if (calendarRef.current) {
      try {
        // Create canvas from the calendar element
        const canvas = await html2canvas(calendarRef.current, {
          scale: 2,
          useCORS: true,
          backgroundColor: 'white',
          width: calendarRef.current.offsetWidth,
          height: calendarRef.current.offsetHeight
        });
        
        // Create PDF
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        
        // Calculate dimensions to fit A4
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
        
        const imgX = (pdfWidth - imgWidth * ratio) / 2;
        const imgY = 10; // Small margin from top
        
        pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
        
        // Save PDF with apartment number
        const apartmentNumber = getApartmentNumber(calendar.apartmentName);
        const cleanApartmentName = calendar.apartmentName.replace(/[^a-z0-9]/gi, '_');
        const fileName = apartmentNumber 
          ? `${apartmentNumber}_${cleanApartmentName}_${getMonthName(calendar.month)}_${calendar.year}.pdf`
          : `${cleanApartmentName}_${getMonthName(calendar.month)}_${calendar.year}.pdf`;
        pdf.save(fileName);
      } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Error al generar el PDF. Por favor, inténtalo de nuevo.');
      }
    }
  };

  const renderReservationBar = (resInfo: ReservationInfo, index: number) => {
    const { reservation, isCheckin, isCheckout } = resInfo;
    const color = getBookingColor(reservation.Source, reservation.Id);
    
    let borderClass = '';
    if (isCheckin) borderClass += ' border-l-4 border-l-black';
    if (isCheckout) borderClass += ' border-r-4 border-r-black';

    return (
      <div
        key={`${reservation.Id}-${index}`}
        className={`reservation-bar text-white font-bold flex items-center justify-center text-shadow ${borderClass}`}
                  style={{ 
          backgroundColor: color,
          margin: '0 auto',
          height: '85px',
          minHeight: '85px',
          maxHeight: '85px',
          width: '95%',
          paddingLeft: '2px',
          paddingRight: '2px',
          fontSize: '14px'
        }}
      >
        {isCheckout ? (
          <div className="text-center font-bold" style={{ fontSize: '13px' }}>SALIDA</div>
        ) : isCheckin ? (
          <div className="text-center">
            <div className="font-bold leading-tight" style={{ fontSize: '13px' }}>{reservation.Name}</div>
            <div className="opacity-90 leading-tight" style={{ fontSize: '13px' }}>{reservation.Nights}n, {reservation.People}p</div>
          </div>
        ) : (
          <div className="text-center font-bold" style={{ fontSize: '13px' }}>{reservation.Name}</div>
        )}
      </div>
    );
  };



  return (
    <div className="w-full">
      {/* Action buttons - hidden when printing */}
      <div className="no-print mb-4 flex gap-2 justify-end">
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Download size={16} />
          Descargar PDF
        </button>
      </div>

      {/* Calendar container */}
      <div ref={calendarRef} className="print-calendar bg-white w-full max-w-none">
                 {/* Header */}
        <div className="text-center mb-6 pb-4 border-b-4 border-blue-600">
          <h1 className="text-3xl font-bold text-blue-700 mb-2">
            {getApartmentNumber(calendar.apartmentName) && (
              <span className="text-blue-900 mr-2">{getApartmentNumber(calendar.apartmentName)}</span>
            )}
            {calendar.apartmentName}
          </h1>
          <h2 className="text-4xl font-bold text-gray-800">
            {getMonthName(calendar.month)} {calendar.year}
          </h2>
        </div>

        {/* Calendar */}
        <table className="calendar-table border-collapse border-3 border-gray-800 table-fixed mx-auto" style={{ width: '95%' }}>
          <thead>
            <tr>
              {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
                <th key={day} className="border-2 border-gray-600 bg-blue-200 font-bold text-center py-4 text-lg">
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
                  const hasOverlap = checkins.length > 0 && checkouts.length > 0;

                  return (
                    <td
                      key={dayIndex}
                      className={`border-2 border-gray-600 p-3 align-top relative ${
                        day.isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                      }`}
                      style={{ height: '290px' }}
                    >
                      <div className={`font-bold text-lg mb-2 relative z-10 ${
                        day.isCurrentMonth ? 'text-black' : 'text-gray-400'
                      }`}>
                        {day.date.getDate()}
                      </div>
                      
                      <div className="w-full absolute left-0 right-0 flex items-center justify-center" style={{ top: '45px', height: '120px', zIndex: 10 }}>
                        {hasOverlap ? (
                          <div className="flex w-full items-center justify-center">
                            <div className="flex-1 flex items-center justify-center">
                              {checkouts.map((checkout, index) => renderReservationBar(checkout, index))}
                            </div>
                            <div className="flex-1 flex items-center justify-center">
                              {checkins.map((checkin, index) => renderReservationBar(checkin, index))}
                            </div>
                          </div>
                        ) : (
                          <div className="w-full flex items-center justify-center">
                            {day.reservations.map((resInfo, index) => 
                              renderReservationBar(resInfo, index)
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Legend */}
        <div className="mt-6 p-4 bg-gray-50 border-2 border-gray-300">
          <div className="text-center">
            <div className="text-sm font-semibold text-gray-700 mb-3">Total Reservas: {calendar.totalBookings}</div>
            <div className="flex justify-center gap-8 text-sm">
              <div className="flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded" 
                  style={{ backgroundColor: getBookingColor('Airbnb') }}
                ></div>
                <span className="font-medium">Airbnb</span>
              </div>
              <div className="flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded" 
                  style={{ backgroundColor: getBookingColor('VRBO') }}
                ></div>
                <span className="font-medium">VRBO</span>
              </div>
              <div className="flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded" 
                  style={{ backgroundColor: getBookingColor('Website') }}
                ></div>
                <span className="font-medium">Website</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarDisplay; 