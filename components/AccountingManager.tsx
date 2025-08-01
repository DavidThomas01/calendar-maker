'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Calculator, 
  Filter, 
  ChevronDown, 
  LogOut, 
  Euro, 
  Calendar,
  X,
  User,
  Mail,
  Phone,
  Building,
  TrendingUp,
  Clock,
  DollarSign,
  Settings
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { generateCleanDisplayName } from '@/lib/calendar-utils';

// Extended interface for accounting data
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

interface AccountingReservation {
  id: string;
  guestName: string;
  email: string;
  phone: string;
  propertyName: string;
  propertyId: number;
  arrival: Date;
  departure: Date;
  nights: number;
  source: string;
  totalAmount: number;
  netAmount: number;
  commission: number;
  commissionRate: number;
  currency: string;
  status: string;
  createdAt: Date;
  people: number;
}

// Property mapping (CORRECTED to match CSV data and admin calendar)
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

// Time period options
const TIME_PERIODS = [
  { value: 'next_week', label: 'Próxima semana', days: 7 },
  { value: 'next_2_weeks', label: 'Próximas 2 semanas', days: 14 },
  { value: 'next_month', label: 'Próximo mes', days: 30 },
  { value: 'next_3_months', label: 'Próximos 3 meses', days: 90 },
  { value: 'custom', label: 'Período personalizado', days: 0 }
];

export default function AccountingManager() {
  const { logout } = useAuth();
  const [reservations, setReservations] = useState<AccountingReservation[]>([]);
  const [filteredReservations, setFilteredReservations] = useState<AccountingReservation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Filters
  const [selectedProperty, setSelectedProperty] = useState<string>('all');
  const [selectedTimePeriod, setSelectedTimePeriod] = useState<string>('next_month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  
  // Modal state
  const [selectedReservation, setSelectedReservation] = useState<AccountingReservation | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const handleLogout = () => {
    if (confirm('¿Cerrar sesión?')) {
      logout();
    }
  };

  // Calculate commission based on source
  const calculateCommission = (source: string, totalAmount: number): { commission: number; commissionRate: number; netAmount: number } => {
    const commissionSources = ['Airbnb', 'VRBO'];
    const commissionRate = commissionSources.includes(source) ? 15 : 0;
    const commission = (totalAmount * commissionRate) / 100;
    const netAmount = totalAmount - commission;
    
    return { commission, commissionRate, netAmount };
  };

  // Map source values
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

  // Convert Lodgify data to accounting format
  const convertToAccountingReservation = (lodgifyRes: LodgifyReservation): AccountingReservation => {
    const propertyName = PROPERTY_NAMES.get(lodgifyRes.property_id) || `Propiedad ${lodgifyRes.property_id}`;
    const source = mapSource(lodgifyRes.source || 'direct');
    const totalAmount = lodgifyRes.total_amount || 0;
    const { commission, commissionRate, netAmount } = calculateCommission(source, totalAmount);
    
    const arrivalDate = new Date(lodgifyRes.arrival);
    const departureDate = new Date(lodgifyRes.departure);
    const nights = Math.ceil((departureDate.getTime() - arrivalDate.getTime()) / (1000 * 60 * 60 * 24));

    return {
      id: lodgifyRes.id.toString(),
      guestName: lodgifyRes.guest?.name || 'Sin nombre',
      email: lodgifyRes.guest?.email || '',
      phone: lodgifyRes.guest?.phone || '',
      propertyName,
      propertyId: lodgifyRes.property_id,
      arrival: arrivalDate,
      departure: departureDate,
      nights,
      source,
      totalAmount,
      netAmount,
      commission,
      commissionRate,
      currency: lodgifyRes.currency_code || 'EUR',
      status: lodgifyRes.status || 'Unknown',
      createdAt: new Date(lodgifyRes.created_at || new Date()),
      people: lodgifyRes.people_count || 1
    };
  };

  // Calculate date range based on selected time period
  const getDateRange = useCallback(() => {
    const today = new Date();
    let startDate = new Date(today);
    let endDate = new Date(today);

    if (selectedTimePeriod === 'custom') {
      if (customStartDate && customEndDate) {
        startDate = new Date(customStartDate);
        endDate = new Date(customEndDate);
      }
    } else {
      const period = TIME_PERIODS.find(p => p.value === selectedTimePeriod);
      if (period && period.days > 0) {
        // Start from today, end after the specified number of days
        startDate = new Date(today);
        endDate = new Date(today);
        endDate.setDate(today.getDate() + period.days);
      }
    }

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
  }, [selectedTimePeriod, customStartDate, customEndDate]);

  // Fetch reservations from Lodgify
  const fetchReservations = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const { startDate, endDate } = getDateRange();
      
      console.log(`📊 Accounting Manager: Fetching reservations from ${startDate} to ${endDate}`);
      
      const response = await fetch(`/api/lodgify/reservations?startDate=${startDate}&endDate=${endDate}`);
      if (!response.ok) {
        throw new Error('Error al obtener las reservas');
      }
      
      const reservationsResponse = await response.json();
      const lodgifyReservations: LodgifyReservation[] = reservationsResponse.items || [];
      
      console.log(`📊 Accounting Manager: Found ${lodgifyReservations.length} reservations`);
      
      // Convert to accounting format
      const accountingReservations = lodgifyReservations.map(convertToAccountingReservation);
      
      setReservations(accountingReservations);
      applyFilters(accountingReservations);
      
    } catch (err) {
      console.error('Error:', err);
      setError('No se pudieron cargar las reservas. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  // Apply property and date filters
  const applyFilters = useCallback((reservationList: AccountingReservation[]) => {
    let filtered = [...reservationList];
    
    // Get the current date range for filtering
    const { startDate, endDate } = getDateRange();
    const filterStartDate = new Date(startDate);
    const filterEndDate = new Date(endDate);
    
    console.log(`🔍 Frontend filtering: ${startDate} to ${endDate}`);
    console.log(`📊 Before filtering: ${filtered.length} reservations`);
    
    // Filter by date range - include reservations that overlap with the selected period
    // A reservation overlaps if: arrival <= endDate AND departure >= startDate
    filtered = filtered.filter(reservation => {
      const arrivalDate = new Date(reservation.arrival);
      const departureDate = new Date(reservation.departure);
      
      // Set times to beginning/end of day for accurate comparison
      const arrival = new Date(arrivalDate.getFullYear(), arrivalDate.getMonth(), arrivalDate.getDate());
      const departure = new Date(departureDate.getFullYear(), departureDate.getMonth(), departureDate.getDate());
      const start = new Date(filterStartDate.getFullYear(), filterStartDate.getMonth(), filterStartDate.getDate());
      const end = new Date(filterEndDate.getFullYear(), filterEndDate.getMonth(), filterEndDate.getDate());
      
      const overlaps = arrival <= end && departure >= start;
      
      if (!overlaps) {
        console.log(`❌ Filtered out: ${reservation.guestName} (${arrival.toDateString()} - ${departure.toDateString()})`);
      }
      
      return overlaps;
    });
    
    console.log(`📊 After date filtering: ${filtered.length} reservations`);
    
    // Filter by property
    if (selectedProperty !== 'all') {
      const propertyId = parseInt(selectedProperty);
      filtered = filtered.filter(r => r.propertyId === propertyId);
      console.log(`📊 After property filtering: ${filtered.length} reservations`);
    }
    
    // Sort by arrival date (soonest first - ascending order)
    filtered.sort((a, b) => a.arrival.getTime() - b.arrival.getTime());
    
    console.log(`📊 Final filtered and sorted: ${filtered.length} reservations`);
    if (filtered.length > 0) {
      console.log(`📅 Date range: ${filtered[0].arrival.toDateString()} to ${filtered[filtered.length - 1].arrival.toDateString()}`);
    }
    
    setFilteredReservations(filtered);
  }, [getDateRange, selectedProperty, setFilteredReservations]);

  // Apply filters when property selection or time period changes
  useEffect(() => {
    if (reservations.length > 0) {
      applyFilters(reservations);
    }
  }, [selectedProperty, selectedTimePeriod, customStartDate, customEndDate, reservations, applyFilters]);

  // Format currency
  const formatCurrency = (amount: number, currency: string = 'EUR') => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  // Format date
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Calculate totals
  const calculateTotals = () => {
    const totalRevenue = filteredReservations.reduce((sum, r) => sum + r.totalAmount, 0);
    const totalCommissions = filteredReservations.reduce((sum, r) => sum + r.commission, 0);
    const totalNet = filteredReservations.reduce((sum, r) => sum + r.netAmount, 0);
    
    return { totalRevenue, totalCommissions, totalNet };
  };

  const { totalRevenue, totalCommissions, totalNet } = calculateTotals();

  // Handle reservation click
  const handleReservationClick = (reservation: AccountingReservation) => {
    setSelectedReservation(reservation);
    setShowDetailsModal(true);
  };

  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedReservation(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {/* Brand Name - Clickable */}
              <Link 
                href="/"
                className="flex items-center hover:opacity-80 transition-opacity"
              >
                <Settings className="h-6 w-6 text-blue-600 mr-2" />
                <span className="text-lg font-bold text-gray-900">MarketingManager</span>
              </Link>
              
              {/* Divider */}
              <div className="w-px h-6 bg-gray-300"></div>
              
              {/* Current Section */}
              <div className="flex items-center">
                <Calculator className="h-5 w-5 text-green-600 mr-2" />
                <h1 className="text-lg font-semibold text-green-700">Gestor Contable</h1>
              </div>
            </div>
            
            <button
              onClick={handleLogout}
              className="flex items-center px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <LogOut className="h-4 w-4 mr-1" />
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* Filters Section */}
      <div className="bg-white border-b px-4 py-4">
        <div className="space-y-4">
          {/* Time Period Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Clock className="h-4 w-4 inline mr-1" />
              Período de tiempo
            </label>
            <select
              value={selectedTimePeriod}
              onChange={(e) => {
                setSelectedTimePeriod(e.target.value);
                // Clear reservations to force re-fetch with new date range
                setReservations([]);
                setFilteredReservations([]);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              {TIME_PERIODS.map((period) => (
                <option key={period.value} value={period.value}>
                  {period.label}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Date Range */}
          {selectedTimePeriod === 'custom' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Fecha inicio</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => {
                    setCustomStartDate(e.target.value);
                    // Clear reservations to force re-filter
                    if (reservations.length > 0) {
                      setFilteredReservations([]);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Fecha fin</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => {
                    setCustomEndDate(e.target.value);
                    // Clear reservations to force re-filter
                    if (reservations.length > 0) {
                      setFilteredReservations([]);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          {/* Property Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Building className="h-4 w-4 inline mr-1" />
              Apartamento
            </label>
            <select
              value={selectedProperty}
              onChange={(e) => setSelectedProperty(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="all">Todos los apartamentos</option>
              {Array.from(PROPERTY_NAMES.entries()).map(([id, name]) => (
                <option key={id} value={id.toString()}>
                  {generateCleanDisplayName(name)}
                </option>
              ))}
            </select>
          </div>

          {/* Search Button */}
          <button
            onClick={fetchReservations}
            disabled={isLoading}
            className="w-full py-3 px-4 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Cargando...
              </>
            ) : (
              <>
                <Filter className="h-5 w-5 mr-2" />
                Buscar Reservas
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
              onClick={fetchReservations}
              className="w-full mt-3 px-4 py-2 bg-red-600 text-white rounded-lg"
            >
              Intentar de nuevo
            </button>
          </div>
        )}

        {/* Summary Cards */}
        {filteredReservations.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center">
                <TrendingUp className="h-5 w-5 text-blue-600 mr-2" />
                <span className="text-sm font-medium text-blue-900">Ingresos Totales</span>
              </div>
              <p className="text-2xl font-bold text-blue-900 mt-1">
                {formatCurrency(totalRevenue)}
              </p>
            </div>
            
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <DollarSign className="h-5 w-5 text-red-600 mr-2" />
                <span className="text-sm font-medium text-red-900">Comisiones</span>
              </div>
              <p className="text-2xl font-bold text-red-900 mt-1">
                {formatCurrency(totalCommissions)}
              </p>
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center">
                <Euro className="h-5 w-5 text-green-600 mr-2" />
                <span className="text-sm font-medium text-green-900">Ingresos Netos</span>
              </div>
              <p className="text-2xl font-bold text-green-900 mt-1">
                {formatCurrency(totalNet)}
              </p>
            </div>
          </div>
        )}

        {/* Reservations Table */}
        {filteredReservations.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                Reservas ({filteredReservations.length})
              </h3>
            </div>
            
            {/* Mobile View */}
            <div className="block md:hidden">
              {filteredReservations.map((reservation) => (
                <div
                  key={reservation.id}
                  onClick={() => handleReservationClick(reservation)}
                  className="p-4 border-b border-gray-200 hover:bg-gray-50 cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-semibold text-gray-900">{reservation.guestName}</h4>
                      <p className="text-sm text-gray-600">{generateCleanDisplayName(reservation.propertyName)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-600">{formatCurrency(reservation.netAmount)}</p>
                      {reservation.commissionRate > 0 && (
                        <p className="text-xs text-red-600">-{formatCurrency(reservation.commission)}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>{formatDate(reservation.arrival)} - {formatDate(reservation.departure)}</span>
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                      {reservation.source}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Huésped / Apartamento
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fechas
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Plataforma
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Precio Total
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Comisión
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Precio Neto
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredReservations.map((reservation) => (
                    <tr
                      key={reservation.id}
                      onClick={() => handleReservationClick(reservation)}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{reservation.guestName}</div>
                          <div className="text-sm text-gray-500">{generateCleanDisplayName(reservation.propertyName)}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div>
                          <div>{formatDate(reservation.arrival)}</div>
                          <div className="text-gray-500">↓ {formatDate(reservation.departure)}</div>
                          <div className="text-xs text-gray-400">{reservation.nights} noches</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                          {reservation.source}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                        {formatCurrency(reservation.totalAmount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        {reservation.commissionRate > 0 ? (
                          <div className="text-red-600">
                            <div>{formatCurrency(reservation.commission)}</div>
                            <div className="text-xs">({reservation.commissionRate}%)</div>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-green-600">
                        {formatCurrency(reservation.netAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {filteredReservations.length === 0 && !isLoading && !error && reservations.length >= 0 && (
          <div className="text-center py-12">
            <Calculator className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 text-lg">
              {reservations.length === 0 
                ? 'Selecciona un período y haz clic en "Buscar Reservas"'
                : 'No hay reservas para los filtros seleccionados'
              }
            </p>
          </div>
        )}
      </main>

      {/* Reservation Details Modal */}
      {showDetailsModal && selectedReservation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                Detalles Financieros
              </h3>
              <button
                onClick={closeDetailsModal}
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
                  <span className="font-medium text-blue-900">Información del Huésped</span>
                </div>
                <p className="font-semibold text-gray-900">{selectedReservation.guestName}</p>
                <p className="text-sm text-gray-600">ID: {selectedReservation.id}</p>
                {selectedReservation.email && (
                  <div className="flex items-center mt-1">
                    <Mail className="h-3 w-3 text-gray-500 mr-1" />
                    <span className="text-xs text-gray-600">{selectedReservation.email}</span>
                  </div>
                )}
                {selectedReservation.phone && (
                  <div className="flex items-center mt-1">
                    <Phone className="h-3 w-3 text-gray-500 mr-1" />
                    <span className="text-xs text-gray-600">{selectedReservation.phone}</span>
                  </div>
                )}
              </div>

              {/* Property and Stay Info */}
              <div className="bg-gray-50 rounded-lg p-3">
                <h4 className="font-medium text-gray-900 mb-3">Detalles de la Reserva</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Apartamento:</span>
                    <span className="font-medium">{generateCleanDisplayName(selectedReservation.propertyName)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Entrada:</span>
                    <span className="font-medium">{formatDate(selectedReservation.arrival)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Salida:</span>
                    <span className="font-medium">{formatDate(selectedReservation.departure)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Noches:</span>
                    <span className="font-medium">{selectedReservation.nights}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Personas:</span>
                    <span className="font-medium">{selectedReservation.people}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Plataforma:</span>
                    <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                      {selectedReservation.source}
                    </span>
                  </div>
                </div>
              </div>

              {/* Financial Breakdown */}
              <div className="bg-green-50 rounded-lg p-3">
                <h4 className="font-medium text-green-900 mb-3">Desglose Financiero</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Precio Total Pagado:</span>
                    <span className="text-lg font-semibold text-gray-900">
                      {formatCurrency(selectedReservation.totalAmount, selectedReservation.currency)}
                    </span>
                  </div>
                  
                  {selectedReservation.commissionRate > 0 && (
                    <div className="flex justify-between items-center text-red-600">
                      <span>Comisión ({selectedReservation.commissionRate}%):</span>
                      <span className="font-semibold">
                        -{formatCurrency(selectedReservation.commission, selectedReservation.currency)}
                      </span>
                    </div>
                  )}
                  
                  <div className="border-t border-green-200 pt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-green-700 font-medium">Ingreso Neto:</span>
                      <span className="text-xl font-bold text-green-700">
                        {formatCurrency(selectedReservation.netAmount, selectedReservation.currency)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-500 mt-2">
                    <p>• Las comisiones del 15% se aplican a reservas de Airbnb y VRBO</p>
                    <p>• Booking.com y Website no tienen comisión en esta vista</p>
                  </div>
                </div>
              </div>

              {/* Additional Info */}
              <div className="text-xs text-gray-500">
                <div className="flex justify-between">
                  <span>Estado:</span>
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                    {selectedReservation.status}
                  </span>
                </div>
                <div className="flex justify-between mt-1">
                  <span>Fecha de creación:</span>
                  <span>{formatDate(selectedReservation.createdAt)}</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t">
              <button
                onClick={closeDetailsModal}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
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