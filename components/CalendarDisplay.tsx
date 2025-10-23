'use client';

import React, { useRef, useState, useEffect } from 'react';
import { ApartmentCalendar, ReservationInfo, DayComment } from '@/lib/types';
import { getBookingColor, getMonthName, getApartmentNumber, generateCalendarFilename, generateCleanDisplayName } from '@/lib/calendar-utils';
import { Download, X, User, Mail, Home, MessageSquare } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import DayComments from './DayComments';
import GeneralDayComments from './GeneralDayComments';
import { useAuth } from './AuthProvider';

interface CalendarDisplayProps {
  calendar: ApartmentCalendar;
  onDownload?: () => void;
}

const CalendarDisplay: React.FC<CalendarDisplayProps> = ({ calendar, onDownload }) => {
  const calendarRef = useRef<HTMLDivElement>(null);
  const { userType } = useAuth();
  const [updatedReservations, setUpdatedReservations] = useState<Map<string, ReservationInfo>>(new Map());
  const [dayComments, setDayComments] = useState<Map<string, DayComment[]>>(new Map());
  const [selectedDayComments, setSelectedDayComments] = useState<{day: Date, comments: {reservation: any, comments: DayComment[]}[]} | null>(null);
  const [selectedReservation, setSelectedReservation] = useState<any | null>(null);

  const isOwner = userType === 'owner';

  // Initialize both general day comments and reservation comments when calendar loads
  useEffect(() => {
    const loadAllComments = async () => {
      try {
        // Generate date range for this calendar month
        const monthStart = new Date(calendar.year, calendar.month - 1, 1);
        const monthEnd = new Date(calendar.year, calendar.month, 0);
        
        // Import functions
        const { fetchGeneralDayComments, fetchCommentsForBookings } = await import('@/lib/calendar-utils');
        
        // Fetch general day comments for this apartment and month
        const generalComments = await fetchGeneralDayComments(calendar.apartmentName, monthStart, monthEnd);
        
        // Group general comments by day booking ID
        const commentsByDay = new Map<string, DayComment[]>();
        generalComments.forEach(comment => {
          if (comment.bookingId.startsWith('DAY_')) {
            const existingComments = commentsByDay.get(comment.bookingId) || [];
            commentsByDay.set(comment.bookingId, [...existingComments, comment]);
          }
        });
        setDayComments(commentsByDay);
        
        // Extract all booking IDs from calendar reservations
        const bookingIds: string[] = [];
        calendar.weeks.forEach(week => {
          week.days.forEach(day => {
            day.reservations.forEach(resInfo => {
              if (!bookingIds.includes(resInfo.reservation.Id)) {
                bookingIds.push(resInfo.reservation.Id);
              }
            });
          });
        });
        
        // Fetch reservation comments
        if (bookingIds.length > 0) {
          const reservationComments = await fetchCommentsForBookings(bookingIds);
          
          // Group reservation comments and update reservation state
          const newUpdatedReservations = new Map<string, ReservationInfo>();
          
          calendar.weeks.forEach(week => {
            week.days.forEach(day => {
              day.reservations.forEach(resInfo => {
                const commentsForThisReservation = reservationComments.filter(
                  comment => comment.bookingId === resInfo.reservation.Id
                );
                
                if (commentsForThisReservation.length > 0) {
                  const key = `${resInfo.reservation.Id}-${day.date.toDateString()}`;
                  newUpdatedReservations.set(key, {
                    ...resInfo,
                    comments: commentsForThisReservation
                  });
                }
              });
            });
          });
          
          setUpdatedReservations(newUpdatedReservations);
          console.log(`📝 Loaded ${reservationComments.length} reservation comments for ${calendar.apartmentName}`);
        }
        
        console.log(`📝 Loaded ${generalComments.length} general day comments for ${calendar.apartmentName}`);
      } catch (error) {
        console.error('Error loading comments:', error);
      }
    };

    loadAllComments();
  }, [calendar.apartmentName, calendar.year, calendar.month]); // Re-run when calendar changes

  // Handle comment updates for specific reservations
  const handleCommentsUpdate = (bookingId: string, comments: DayComment[]) => {
    // Check if this is a day comment (special booking ID format)
    if (bookingId.startsWith('DAY_')) {
      // Handle day-level comments
      const newDayComments = new Map(dayComments);
      newDayComments.set(bookingId, comments);
      setDayComments(newDayComments);
    } else {
      // Handle reservation comments
      const newUpdatedReservations = new Map(updatedReservations);
      
      // Find and update the reservation with new comments across all days
      calendar.weeks.forEach(week => {
        week.days.forEach(day => {
          day.reservations.forEach(resInfo => {
            if (resInfo.reservation.Id === bookingId) {
              const updatedResInfo = { ...resInfo, comments };
              newUpdatedReservations.set(`${bookingId}-${day.date.toDateString()}`, updatedResInfo);
            }
          });
        });
      });
      
      setUpdatedReservations(newUpdatedReservations);
    }
  };

  // Get reservation info with updated comments
  const getReservationInfo = (resInfo: ReservationInfo, dateKey: string): ReservationInfo => {
    const key = `${resInfo.reservation.Id}-${dateKey}`;
    return updatedReservations.get(key) || resInfo;
  };

  // Generate day booking ID for day-level comments
  const generateDayBookingId = (date: Date, apartmentName: string): string => {
    // Use local date formatting to avoid timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    return `DAY_${dateStr}_${apartmentName.replace(/\s+/g, '_')}`;
  };

  // Get day-level comments for a specific day
  const getDayLevelComments = (day: any): DayComment[] => {
    const dayBookingId = generateDayBookingId(day.date, calendar.apartmentName);
    return dayComments.get(dayBookingId) || [];
  };

  // Check if a day has any comments (reservation or day-level)
  const dayHasComments = (day: any): boolean => {
    // Check reservation comments
    const hasReservationComments = day.reservations.some((resInfo: any) => {
      const updatedResInfo = getReservationInfo(resInfo, day.date.toDateString());
      return updatedResInfo.comments && updatedResInfo.comments.length > 0;
    });
    
    // Check day-level comments
    const hasDayComments = getDayLevelComments(day).length > 0;
    
    return hasReservationComments || hasDayComments;
  };

  // Check specifically for general day comments (yellow comments)
  const dayHasGeneralComments = (day: any): boolean => {
    return getDayLevelComments(day).length > 0;
  };

  // Get all comments for a day
  const getDayComments = (day: any) => {
    const commentsData: {reservation: any, comments: DayComment[]}[] = [];
    day.reservations.forEach((resInfo: any) => {
      const updatedResInfo = getReservationInfo(resInfo, day.date.toDateString());
      if (updatedResInfo.comments && updatedResInfo.comments.length > 0) {
        commentsData.push({
          reservation: resInfo.reservation,
          comments: updatedResInfo.comments
        });
      }
    });
    return commentsData;
  };

  // Handle day click to show comments or enable comment adding
  const handleDayClick = (day: any, event: React.MouseEvent) => {
    // Prevent day click if clicking on a reservation bar
    if ((event.target as HTMLElement).closest('.reservation-bar')) {
      return;
    }
    
    // Check if clicking in the lower part of the day (for general comments)
    const target = event.target as HTMLElement;
    const cellRect = target.closest('td')?.getBoundingClientRect();
    if (cellRect) {
      const clickY = event.clientY;
      const cellBottom = cellRect.bottom;
      const cellHeight = cellRect.height;
      const lowerThird = cellBottom - (cellHeight * 0.33); // Lower third of the cell
      
      // If clicking in lower third and day has general comments, show them
      if (clickY >= lowerThird && dayHasGeneralComments(day)) {
        const generalComments = getDayLevelComments(day);
        setSelectedDayComments({ 
          day: day.date, 
          comments: [{ 
            reservation: null, // No reservation for general comments
            comments: generalComments 
          }] 
        });
        return;
      }
    }
    
    // Only owners can interact with day comments
    if (!isOwner) return;
    
    // Default behavior - show all comments if any exist
    if (dayHasComments(day)) {
      const commentsData = getDayComments(day);
      setSelectedDayComments({ day: day.date, comments: commentsData });
    }
  };

  // Handle reservation click to show reservation details with comments
  const handleReservationClick = (resInfo: ReservationInfo, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent day click
    setSelectedReservation(resInfo);
  };

  // Get comments for a specific reservation (deduplicated)
  const getReservationComments = (reservation: any): DayComment[] => {
    const commentsMap = new Map<string, DayComment>();
    calendar.weeks.forEach(week => {
      week.days.forEach(day => {
        day.reservations.forEach(resInfo => {
          if (resInfo.reservation.Id === reservation.Id && resInfo.comments) {
            resInfo.comments.forEach(comment => {
              // Use comment ID as key to avoid duplicates
              commentsMap.set(comment.id, comment);
            });
          }
        });
      });
    });
    return Array.from(commentsMap.values());
  };



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
        
        // Save PDF with new filename format
        const fileName = generateCalendarFilename(calendar.apartmentName, calendar.month, calendar.year);
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
        className={`reservation-bar text-white font-bold flex items-center justify-center text-shadow cursor-pointer hover:opacity-80 transition-opacity ${borderClass}`}
        style={{ 
          backgroundColor: color,
          margin: '0 auto',
          height: '85px',
          minHeight: '85px',
          maxHeight: '85px',
          width: '95%',
          paddingLeft: '2px',
          paddingRight: '2px',
          fontSize: '20px'
        }}
        onClick={(e) => handleReservationClick(resInfo, e)}
      >
        {isCheckout ? (
          <div className="text-center font-bold" style={{ fontSize: '20px' }}>SALIDA</div>
        ) : isCheckin ? (
          <div className="text-center">
            <div className="font-bold leading-tight" style={{ fontSize: '20px' }}>{reservation.Name}</div>
            <div className="opacity-90 leading-tight" style={{ fontSize: '16px' }}>{reservation.Nights}n, {reservation.People}p</div>
          </div>
        ) : (
          <div className="text-center font-bold" style={{ fontSize: '20px' }}>{reservation.Name}</div>
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
      <div ref={calendarRef} className="print-calendar bg-white w-full max-w-none relative">
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

        {/* Legend - Top Right Corner */}
        <div className="absolute top-4 right-4 bg-white border-2 border-gray-300 rounded-lg p-3 shadow-sm z-10" style={{ fontSize: '12px' }}>
          <div className="text-xs font-semibold text-gray-700 mb-2 text-center">
            Reservas: {calendar.totalBookings}
            {calendar.totalBookings === 0 && (
              <div className="text-xs text-green-600 mt-1 font-medium">✓ Calendario vacío</div>
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded" 
                style={{ backgroundColor: getBookingColor('Airbnb') }}
              ></div>
              <span className="text-xs font-medium">Airbnb</span>
            </div>
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded" 
                style={{ backgroundColor: getBookingColor('VRBO') }}
              ></div>
              <span className="text-xs font-medium">VRBO</span>
            </div>
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded" 
                style={{ backgroundColor: getBookingColor('Website') }}
              ></div>
              <span className="text-xs font-medium">Web</span>
            </div>
          </div>
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

                  const hasComments = dayHasComments(day);
                  
                  return (
                    <td
                      key={dayIndex}
                      className={`border-2 border-gray-600 p-3 align-top relative group ${
                        day.isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                      } ${isOwner ? 'cursor-pointer hover:bg-blue-50' : ''} ${
                        dayHasGeneralComments(day) ? 'ring-4 ring-yellow-400 ring-inset' : 
                        hasComments ? 'ring-2 ring-orange-200' : ''
                      }`}
                      style={{ height: '290px' }}
                      onClick={(e) => handleDayClick(day, e)}
                    >
                      <div className={`text-lg mb-2 relative z-10 ${
                        hasComments 
                          ? 'text-orange-600 font-bold underline' 
                          : `font-bold ${day.isCurrentMonth ? 'text-black' : 'text-gray-400'}`
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

                      {/* Comments Section - Below reservations */}
                      <div className="absolute left-1 right-1 bottom-1" style={{ top: '170px', maxHeight: '115px', overflowY: 'auto' }}>
                        {/* Reservation Comments - Only show for check-in days to avoid duplication */}
                        {day.reservations.length > 0 && day.reservations.map((resInfo, index) => {
                          const updatedResInfo = getReservationInfo(resInfo, day.date.toDateString());
                          // Only show comments for check-in days to avoid duplication
                          if (!resInfo.isCheckin) return null;
                          
                          return (
                            <DayComments
                              key={`${resInfo.reservation.Id}-${index}`}
                              reservation={resInfo.reservation}
                              comments={updatedResInfo.comments || []}
                              isOwner={isOwner}
                              onCommentsUpdate={handleCommentsUpdate}
                            />
                          );
                        })}
                        
                        {/* Day-Level Comments - Always show for any day */}
                        <GeneralDayComments
                          key={`day-${day.date.toDateString()}`}
                          date={day.date}
                          apartmentName={calendar.apartmentName}
                          comments={getDayLevelComments(day)}
                          isOwner={isOwner}
                          onCommentsUpdate={handleCommentsUpdate}
                        />
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Comments Modal */}
      {selectedDayComments && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-96 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                Comentarios - {selectedDayComments.day.toLocaleDateString('es-ES', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </h3>
              <button
                onClick={() => setSelectedDayComments(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4">
              {selectedDayComments.comments.map((commentData, index) => (
                <div key={index} className="border-b border-gray-200 pb-4 last:border-b-0">
                  {commentData.reservation ? (
                    // Reservation comments
                    <>
                      <h4 className="font-medium text-gray-900 mb-2">
                        {commentData.reservation.Name}
                      </h4>
                      <div className="space-y-2">
                        {commentData.comments.map((comment) => (
                          <div key={comment.id} className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                            {comment.text}
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    // General day comments (yellow)
                    <>
                      <h4 className="font-medium text-yellow-700 mb-2 flex items-center">
                        <span className="inline-block w-3 h-3 bg-yellow-400 rounded-full mr-2"></span>
                        Comentario General del Día
                      </h4>
                      <div className="space-y-2">
                        {commentData.comments.map((comment) => (
                          <div key={comment.id} className="text-sm text-gray-700 bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded">
                            {comment.text}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
            
            <div className="mt-4 text-center">
              <button
                onClick={() => setSelectedDayComments(null)}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reservation Details Modal */}
      {selectedReservation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                Información de Reserva
              </h3>
              <button
                onClick={() => setSelectedReservation(null)}
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
                <p className="text-lg font-semibold text-gray-900">{selectedReservation.reservation.Name}</p>
                <p className="text-sm text-gray-600">ID: {selectedReservation.reservation.Id}</p>
              </div>

              {/* Contact Info - Only show email */}
              {selectedReservation.reservation.Email && (
                <div className="space-y-2">
                  <div className="flex items-center">
                    <Mail className="h-4 w-4 text-gray-500 mr-2" />
                    <span className="text-sm text-gray-700">{selectedReservation.reservation.Email}</span>
                  </div>
                </div>
              )}

              {/* Stay Details */}
              <div className="bg-gray-50 rounded-lg p-3">
                <h4 className="font-medium text-gray-900 mb-3">Detalles de la Estancia</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Entrada:</span>
                    <span className="font-medium">{selectedReservation.reservation.DateArrival.toLocaleDateString('es-ES', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Salida:</span>
                    <span className="font-medium">{selectedReservation.reservation.DateDeparture.toLocaleDateString('es-ES', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Noches:</span>
                    <span className="font-medium">{selectedReservation.reservation.Nights}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Personas:</span>
                    <span className="font-medium">{selectedReservation.reservation.People}</span>
                  </div>
                </div>
              </div>

              {/* Property Info */}
              <div className="bg-green-50 rounded-lg p-3">
                <div className="flex items-center mb-2">
                  <Home className="h-4 w-4 text-green-600 mr-2" />
                  <span className="font-medium text-green-900">Propiedad</span>
                </div>
                <p className="font-semibold text-gray-900">{generateCleanDisplayName(selectedReservation.reservation.HouseName)}</p>
              </div>

              {/* Booking Source */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Plataforma:</span>
                <div className="flex items-center">
                  <div 
                    className="w-3 h-3 rounded mr-2"
                    style={{ backgroundColor: getBookingColor(selectedReservation.reservation.Source, selectedReservation.reservation.Id) }}
                  ></div>
                  <span className="font-medium text-sm">{selectedReservation.reservation.Source}</span>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Estado:</span>
                <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                  {selectedReservation.reservation.Status}
                </span>
              </div>

              {/* Comments Section */}
              {(() => {
                const reservationComments = getReservationComments(selectedReservation.reservation);
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