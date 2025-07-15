'use client';

import React from 'react';
import { Calendar, Upload, Download } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-4xl mx-auto px-6 py-16">
        
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center mb-6">
            <Calendar className="h-12 w-12 text-blue-600 mr-4" />
            <h1 className="text-4xl font-bold text-gray-900">Creador de Calendarios</h1>
          </div>
          <p className="text-lg text-gray-600">
            Genera calendarios de reservas para todas las propiedades
          </p>
        </div>

        {/* Main Action */}
        <div className="bg-white rounded-xl shadow-lg p-10 text-center mb-12">
          <div className="bg-blue-100 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
            <Download className="h-12 w-12 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Obtener Calendarios
          </h2>
          <p className="text-gray-600 mb-8">
            Conecta con Lodgify para obtener las reservas confirmadas y generar calendarios
          </p>
          <Link 
            href="/calendario-automatico"
            className="inline-flex items-center justify-center px-8 py-4 bg-blue-600 text-white text-lg font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="h-5 w-5 mr-2" />
            Comenzar
          </Link>
        </div>

        {/* CSV Upload - Small Button */}
        <div className="text-center">
          <p className="text-sm text-gray-500 mb-3">¿Necesitas subir un archivo CSV?</p>
          <Link 
            href="/subir-csv"
            className="inline-flex items-center justify-center px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            <Upload className="h-4 w-4 mr-2" />
            Subir CSV
          </Link>
        </div>

      </div>
    </div>
  );
} 