'use client';

import React from 'react';
import { Calendar, Calculator, User, LogOut, Settings } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';

export default function OwnerDashboard() {
  const { logout } = useAuth();

  const handleLogout = () => {
    if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
      logout();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Settings className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">MarketingManager</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center text-sm text-gray-600">
                <User className="h-4 w-4 mr-1" />
                <span>Propietario</span>
              </div>
              <button
                onClick={handleLogout}
                className="inline-flex items-center px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
              >
                <LogOut className="h-4 w-4 mr-1" />
                Salir
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Welcome Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Panel de Control
          </h2>
          <p className="text-lg text-gray-600">
            Gestiona todos los aspectos de tus propiedades desde un solo lugar
          </p>
        </div>

        {/* Dashboard Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          
          {/* Calendar Maker Card */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow h-full">
            <div className="p-8 flex flex-col h-full">
              <div className="flex-grow">
                <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mb-6">
                  <Calendar className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  Creador de Calendarios
                </h3>
                <p className="text-gray-600 mb-6">
                  Genera calendarios personalizados para todas tus propiedades con datos de reservas actualizados desde Lodgify.
                </p>
                <div className="space-y-3 mb-8">
                  <div className="flex items-center text-sm text-gray-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                    Integración automática con Lodgify
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                    Generación de PDFs profesionales
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                    Soporte para múltiples propiedades
                  </div>
                </div>
              </div>
              <Link 
                href="/calendario-automatico"
                className="inline-flex items-center justify-center w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Calendar className="h-5 w-5 mr-2" />
                Abrir Creador de Calendarios
              </Link>
            </div>
          </div>

          {/* Accounting Manager Card */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow h-full">
            <div className="p-8 flex flex-col h-full">
              <div className="flex-grow">
                <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mb-6">
                  <Calculator className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  Gestor Contable
                </h3>
                <p className="text-gray-600 mb-6">
                  Analiza los ingresos, comisiones y precios netos de todas tus reservas con filtros por apartamento y período.
                </p>
                <div className="space-y-3 mb-8">
                  <div className="flex items-center text-sm text-gray-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                    Cálculo automático de comisiones (15% Airbnb/VRBO)
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                    Filtros por apartamento y período
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                    Vista detallada de cada reserva
                  </div>
                </div>
              </div>
              <Link 
                href="/gestor-contable"
                className="inline-flex items-center justify-center w-full px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                <Calculator className="h-5 w-5 mr-2" />
                Abrir Gestor Contable
              </Link>
            </div>
          </div>

        </div>

        {/* Quick Actions */}
        <div className="mt-12 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Accesos Rápidos</h3>
          <div className="flex justify-center space-x-4">
            <Link 
              href="/subir-csv"
              className="inline-flex items-center px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            >
              Subir CSV Manual
            </Link>
            <Link 
              href="/calendario-automatico"
              className="inline-flex items-center px-4 py-2 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
            >
              Generar Calendarios
            </Link>
            <Link 
              href="/gestor-contable"
              className="inline-flex items-center px-4 py-2 text-sm bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors"
            >
              Ver Finanzas
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
} 