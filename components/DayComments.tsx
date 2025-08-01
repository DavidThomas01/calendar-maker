'use client';

import React, { useState } from 'react';
import { DayComment, Reservation } from '@/lib/types';
import { MessageSquare, Plus, Edit2, Trash2, Save, X, Type } from 'lucide-react';

interface DayCommentsProps {
  reservation: Reservation;
  comments: DayComment[];
  isOwner: boolean;
  onCommentsUpdate: (bookingId: string, comments: DayComment[]) => void;
}

const FONT_SIZE_OPTIONS = [
  { value: 'small' as const, label: 'Pequeño', class: 'text-xs' },
  { value: 'medium' as const, label: 'Mediano', class: 'text-sm' },
  { value: 'large' as const, label: 'Grande', class: 'text-base' }
];

const DayComments: React.FC<DayCommentsProps> = ({
  reservation,
  comments,
  isOwner,
  onCommentsUpdate
}) => {
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [newCommentFontSize, setNewCommentFontSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [editText, setEditText] = useState('');
  const [editFontSize, setEditFontSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [isLoading, setIsLoading] = useState(false);

  const dateString = reservation.DateArrival.toISOString().split('T')[0]; // YYYY-MM-DD format

  const handleCreateComment = async () => {
    if (!newCommentText.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookingId: reservation.Id,
          apartmentName: reservation.HouseName,
          date: dateString,
          text: newCommentText.trim(),
          fontSize: newCommentFontSize,
          createdBy: 'owner'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create comment');
      }

      const result = await response.json();
      const updatedComments = [result.comment]; // One comment per booking
      onCommentsUpdate(reservation.Id, updatedComments);
      
      setNewCommentText('');
      setNewCommentFontSize('medium');
      setIsAddingComment(false);
    } catch (error) {
      console.error('Error creating comment:', error);
      alert('Error al crear el comentario');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateComment = async (commentId: string) => {
    if (!editText.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/comments', {
        method: 'POST', // Using POST since our API handles update via bookingId
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookingId: reservation.Id,
          apartmentName: reservation.HouseName,
          date: dateString,
          text: editText.trim(),
          fontSize: editFontSize,
          createdBy: 'owner'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update comment');
      }

      const result = await response.json();
      const updatedComments = [result.comment]; // One comment per booking
      onCommentsUpdate(reservation.Id, updatedComments);
      
      setEditingCommentId(null);
      setEditText('');
      setEditFontSize('medium');
    } catch (error) {
      console.error('Error updating comment:', error);
      alert('Error al actualizar el comentario');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteComment = async () => {
    if (!confirm('¿Eliminar este comentario?')) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/comments?bookingId=${reservation.Id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete comment');
      }

      const updatedComments: DayComment[] = []; // No comments after deletion
      onCommentsUpdate(reservation.Id, updatedComments);
    } catch (error) {
      console.error('Error deleting comment:', error);
      alert('Error al eliminar el comentario');
    } finally {
      setIsLoading(false);
    }
  };

  const startEditing = (comment: DayComment) => {
    setEditingCommentId(comment.id);
    setEditText(comment.text);
    setEditFontSize(comment.fontSize);
  };

  const cancelEditing = () => {
    setEditingCommentId(null);
    setEditText('');
    setEditFontSize('medium');
  };

  const getFontSizeClass = (fontSize: 'small' | 'medium' | 'large') => {
    return FONT_SIZE_OPTIONS.find(option => option.value === fontSize)?.class || 'text-sm';
  };

  return (
    <div className="mt-1 space-y-1">
      {/* Existing Comments */}
      {comments.map((comment) => (
        <div key={comment.id} className="group">
          {editingCommentId === comment.id ? (
            // Edit Mode
            <div className="bg-blue-50 border border-blue-200 rounded p-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <Type className="h-3 w-3 text-blue-600" />
                  <select
                    value={editFontSize}
                    onChange={(e) => setEditFontSize(e.target.value as 'small' | 'medium' | 'large')}
                    className="text-xs border border-gray-300 rounded px-1 py-1"
                    disabled={isLoading}
                  >
                    {FONT_SIZE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full text-xs border border-gray-300 rounded p-2 resize-none"
                  rows={2}
                  disabled={isLoading}
                  placeholder="Escribe tu comentario..."
                  autoFocus
                />
                <div className="flex gap-1">
                  <button
                    onClick={() => handleUpdateComment(comment.id)}
                    disabled={isLoading || !editText.trim()}
                    className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    <Save className="h-3 w-3" />
                    Guardar
                  </button>
                  <button
                    onClick={cancelEditing}
                    disabled={isLoading}
                    className="flex items-center gap-1 px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
                  >
                    <X className="h-3 w-3" />
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // Display Mode - Clean comment display
            <div className="relative">
              <div className={`${getFontSizeClass(comment.fontSize)} text-gray-700 leading-tight p-1 rounded`}>
                {comment.text}
              </div>
              {isOwner && (
                <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 no-print">
                  <div className="flex gap-1 bg-white rounded shadow-sm border">
                    <button
                      onClick={() => startEditing(comment)}
                      className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                      title="Editar comentario"
                    >
                      <Edit2 className="h-3 w-3" />
                    </button>
                    <button
                      onClick={handleDeleteComment}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                      title="Eliminar comentario"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Add New Comment (Owner Only) - Only show on day hover if no comment exists */}
      {isOwner && comments.length === 0 && (
        <div>
          {isAddingComment ? (
            <div className="bg-blue-50 border border-blue-200 rounded p-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <Type className="h-3 w-3 text-blue-600" />
                  <select
                    value={newCommentFontSize}
                    onChange={(e) => setNewCommentFontSize(e.target.value as 'small' | 'medium' | 'large')}
                    className="text-xs border border-gray-300 rounded px-1 py-1"
                    disabled={isLoading}
                  >
                    {FONT_SIZE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <textarea
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  className="w-full text-xs border border-gray-300 rounded p-2 resize-none"
                  rows={2}
                  disabled={isLoading}
                  placeholder="Escribe tu comentario..."
                  autoFocus
                />
                <div className="flex gap-1">
                  <button
                    onClick={handleCreateComment}
                    disabled={isLoading || !newCommentText.trim()}
                    className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Save className="h-3 w-3" />
                    Guardar
                  </button>
                  <button
                    onClick={() => {
                      setIsAddingComment(false);
                      setNewCommentText('');
                      setNewCommentFontSize('medium');
                    }}
                    disabled={isLoading}
                    className="flex items-center gap-1 px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
                  >
                    <X className="h-3 w-3" />
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsAddingComment(true)}
              className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded hover:bg-blue-200 no-print"
            >
              <Plus className="h-3 w-3" />
              Agregar comentario
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default DayComments;