'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Shield, Lock, ArrowLeft, Eye, EyeOff } from 'lucide-react';

interface AuthContextType {
  isAuthenticated: boolean;
  userType: 'owner' | 'staff' | null;
  login: (password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userType, setUserType] = useState<'owner' | 'staff' | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already authenticated
    const authStatus = sessionStorage.getItem('auth_status');
    const savedUserType = sessionStorage.getItem('user_type') as 'owner' | 'staff' | null;
    if (authStatus === 'authenticated' && savedUserType) {
      setIsAuthenticated(true);
      setUserType(savedUserType);
    }
    setIsLoading(false);
  }, []);

  const login = (password: string): boolean => {
    // Check for owner password
    const ownerPasswordHash = btoa('athomeinmadrid');
    const staffPasswordHash = btoa('calendario');
    const inputPasswordHash = btoa(password);
    
    if (inputPasswordHash === ownerPasswordHash) {
      setIsAuthenticated(true);
      setUserType('owner');
      sessionStorage.setItem('auth_status', 'authenticated');
      sessionStorage.setItem('user_type', 'owner');
      return true;
    } else if (inputPasswordHash === staffPasswordHash) {
      setIsAuthenticated(true);
      setUserType('staff');
      sessionStorage.setItem('auth_status', 'authenticated');
      sessionStorage.setItem('user_type', 'staff');
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUserType(null);
    sessionStorage.removeItem('auth_status');
    sessionStorage.removeItem('user_type');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={login} />;
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, userType, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

function LoginPage({ onLogin }: { onLogin: (password: string) => boolean }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Add a small delay to prevent rapid brute force attempts
    await new Promise(resolve => setTimeout(resolve, 500));

    const success = onLogin(password);
    if (!success) {
      setError('Contraseña incorrecta. Acceso denegado.');
      setPassword('');
    }
    setIsLoading(false);
  };

  const handleGoBack = () => {
    // Clear any form data and simulate going back
    setPassword('');
    setError('');
    window.history.back();
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        {/* Warning Header */}
        <div className="text-center">
          <div className="flex items-center justify-center mb-6">
            <Shield className="h-16 w-16 text-red-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Acceso Restringido
          </h1>
          <p className="text-lg text-red-600 font-medium mb-4">
            Solo para propietarios y personal autorizado
          </p>
          <p className="text-sm text-gray-600">
            Si no tienes autorización, por favor regresa a la página anterior.
          </p>
        </div>

        {/* Go Back Button */}
        <div className="text-center">
          <button
            onClick={handleGoBack}
            className="inline-flex items-center justify-center px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Regresar
          </button>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-6">
            <Lock className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900">
              Ingresa la contraseña
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="relative">
              <label htmlFor="password" className="sr-only">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg tracking-wider"
                placeholder="Ingresa la contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700 transition-colors"
                disabled={isLoading}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>

            {error && (
              <div className="text-red-600 text-sm text-center bg-red-50 p-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !password}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                'Acceder'
              )}
            </button>
          </form>
        </div>

        {/* Security Notice */}
        <div className="text-center text-xs text-gray-500">
          <p>Esta página está protegida por contraseña.</p>
          <p>Todos los intentos de acceso son registrados.</p>
        </div>
      </div>
    </div>
  );
} 