import { NextRequest, NextResponse } from 'next/server';
import { DayComment } from '@/lib/types';
import { CommentsStorageService } from '@/lib/storage';

// Initialize storage service
const storageService = CommentsStorageService.getInstance();

// GET - Fetch comments for specific booking IDs
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const bookingIds = searchParams.get('bookingIds');
    const apartmentName = searchParams.get('apartmentName');

    const comments = await storageService.readComments();
    
    let filteredComments = comments;
    
    // Filter by booking IDs if provided (pipe-separated list to handle commas in IDs)
    if (bookingIds) {
      const bookingIdList = bookingIds.split('|').map(id => id.trim());
      filteredComments = filteredComments.filter(comment => 
        bookingIdList.includes(comment.bookingId)
      );
    }
    
    // Filter by apartment if provided (as fallback)
    if (apartmentName && !bookingIds) {
      filteredComments = filteredComments.filter(comment => 
        comment.apartmentName === apartmentName
      );
    }

    return NextResponse.json({
      comments: filteredComments,
      count: filteredComments.length
    });

  } catch (error) {
    console.error('Error fetching comments:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        error: 'Error al obtener los comentarios',
        details: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// POST - Create a new comment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bookingId, apartmentName, date, text, fontSize, createdBy } = body;

    if (!bookingId || !apartmentName || !date || !text || !fontSize || !createdBy) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: bookingId, apartmentName, date, text, fontSize, createdBy' },
        { status: 400 }
      );
    }

    if (!['small', 'medium', 'large'].includes(fontSize)) {
      return NextResponse.json(
        { error: 'Tamaño de fuente inválido. Debe ser: small, medium, o large' },
        { status: 400 }
      );
    }

    if (!['owner', 'staff'].includes(createdBy)) {
      return NextResponse.json(
        { error: 'Tipo de usuario inválido. Debe ser: owner o staff' },
        { status: 400 }
      );
    }

    const comments = await storageService.readComments();
    
    // Check if comment already exists for this booking
    const existingIndex = comments.findIndex(comment => comment.bookingId === bookingId);
    
    const newComment: DayComment = {
      id: existingIndex >= 0 ? comments[existingIndex].id : `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      bookingId,
      apartmentName,
      date,
      text: text.trim(),
      fontSize,
      createdAt: existingIndex >= 0 ? comments[existingIndex].createdAt : new Date(),
      updatedAt: new Date(),
      createdBy
    };

    if (existingIndex >= 0) {
      // Update existing comment
      comments[existingIndex] = newComment;
    } else {
      // Add new comment
      comments.push(newComment);
    }
    
    await storageService.writeComments(comments);

    return NextResponse.json({
      comment: newComment,
      message: existingIndex >= 0 ? 'Comentario actualizado exitosamente' : 'Comentario creado exitosamente'
    }, { status: existingIndex >= 0 ? 200 : 201 });

  } catch (error) {
    console.error('Error creating comment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        error: 'Error al crear el comentario',
        details: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// PUT - Update an existing comment
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, text, fontSize } = body;

    if (!id || !text || !fontSize) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: id, text, fontSize' },
        { status: 400 }
      );
    }

    if (!['small', 'medium', 'large'].includes(fontSize)) {
      return NextResponse.json(
        { error: 'Tamaño de fuente inválido. Debe ser: small, medium, o large' },
        { status: 400 }
      );
    }

    const comments = await storageService.readComments();
    const commentIndex = comments.findIndex(comment => comment.id === id);

    if (commentIndex === -1) {
      return NextResponse.json(
        { error: 'Comentario no encontrado' },
        { status: 404 }
      );
    }

    // Update the comment
    comments[commentIndex] = {
      ...comments[commentIndex],
      text: text.trim(),
      fontSize,
      updatedAt: new Date()
    };

    await storageService.writeComments(comments);

    return NextResponse.json({
      comment: comments[commentIndex],
      message: 'Comentario actualizado exitosamente'
    });

  } catch (error) {
    console.error('Error updating comment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        error: 'Error al actualizar el comentario',
        details: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete a comment by booking ID
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const bookingId = searchParams.get('bookingId');

    if (!bookingId) {
      return NextResponse.json(
        { error: 'ID del booking requerido' },
        { status: 400 }
      );
    }

    const comments = await storageService.readComments();
    const commentIndex = comments.findIndex(comment => comment.bookingId === bookingId);

    if (commentIndex === -1) {
      return NextResponse.json(
        { error: 'Comentario no encontrado para este booking' },
        { status: 404 }
      );
    }

    // Remove the comment
    const deletedComment = comments.splice(commentIndex, 1)[0];
    await storageService.writeComments(comments);

    return NextResponse.json({
      comment: deletedComment,
      message: 'Comentario eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error deleting comment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        error: 'Error al eliminar el comentario',
        details: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}