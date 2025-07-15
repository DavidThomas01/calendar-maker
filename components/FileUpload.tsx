'use client';

import React, { useCallback, useState } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import Papa from 'papaparse';

interface FileUploadProps {
  onFileProcessed: (data: any[]) => void;
  onError: (error: string) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileProcessed, onError }) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const processFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      onError('Por favor, sube un archivo CSV.');
      return;
    }

    setIsProcessing(true);
    setUploadedFile(file);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        setIsProcessing(false);
        if (results.errors.length > 0) {
          onError(`Error al analizar CSV: ${results.errors[0].message}`);
          return;
        }
        
        if (results.data.length === 0) {
          onError('El archivo CSV parece estar vacío.');
          return;
        }

        // Validate required columns
        const requiredColumns = ['HouseName', 'DateArrival', 'DateDeparture', 'Name', 'Source', 'Status', 'People', 'Nights'];
        const headers = Object.keys(results.data[0] as object);
        const missingColumns = requiredColumns.filter(col => !headers.includes(col));
        
        if (missingColumns.length > 0) {
          onError(`Faltan columnas requeridas: ${missingColumns.join(', ')}`);
          return;
        }

        onFileProcessed(results.data);
      },
      error: (error) => {
        setIsProcessing(false);
        onError(`Error al leer el archivo: ${error.message}`);
      }
    });
  }, [onFileProcessed, onError]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      processFile(files[0]);
    }
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  }, [processFile]);

  return (
    <div className="w-full">
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200
          ${isDragActive 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
          }
          ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        onDragEnter={handleDragIn}
        onDragLeave={handleDragOut}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => {
          if (!isProcessing) {
            document.getElementById('file-input')?.click();
          }
        }}
      >
        <input
          id="file-input"
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isProcessing}
        />
        
        <div className="flex flex-col items-center space-y-4">
          {isProcessing ? (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="text-lg font-medium text-gray-600">Procesando archivo CSV...</p>
            </>
          ) : uploadedFile ? (
            <>
              <FileText className="h-12 w-12 text-green-600" />
              <div>
                <p className="text-lg font-medium text-gray-900">Archivo Subido Exitosamente</p>
                <p className="text-sm text-gray-600">{uploadedFile.name}</p>
                <p className="text-xs text-gray-500 mt-2">Haz clic para subir un archivo diferente</p>
              </div>
            </>
          ) : (
            <>
              <Upload className={`h-12 w-12 ${isDragActive ? 'text-blue-600' : 'text-gray-400'}`} />
              <div>
                <p className="text-lg font-medium text-gray-900">
                  {isDragActive ? 'Suelta tu archivo CSV aquí' : 'Subir Archivo CSV'}
                </p>
                <p className="text-sm text-gray-600">
                  Arrastra y suelta tu archivo CSV de reservas aquí, o haz clic para navegar
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Solo admite archivos .csv
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* File format requirements */}
      <div className="mt-4 p-4 bg-blue-50 rounded-lg">
        <div className="flex items-start space-x-2">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-blue-900">Formato CSV Requerido</h4>
            <p className="text-sm text-blue-800 mt-1">
              Tu archivo CSV debe contener las siguientes columnas: HouseName, DateArrival, DateDeparture, 
              Name, Source, Status, People, y Nights.
            </p>
            <p className="text-xs text-blue-700 mt-2">
              Las fechas deben estar en formato YYYY-MM-DD. Solo se incluirán reservas confirmadas (estado: "Booked" o "Open").
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileUpload; 