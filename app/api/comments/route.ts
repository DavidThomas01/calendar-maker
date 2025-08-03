import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { DayComment } from '@/lib/types';

const COMMENTS_FILE = path.join(process.cwd(), 'data', 'comments.json');

// Ensure data directory exists and initialize comments file if needed
async function ensureCommentsFile() {
  try {
    const dataDir = path.join(process.cwd(), 'data');
    await fs.mkdir(dataDir, { recursive: true });
    
    try {
      await fs.access(COMMENTS_FILE);
    } catch {
      // File doesn't exist, create it with empty array
      await fs.writeFile(COMMENTS_FILE, JSON.stringify([], null, 2));
    }
  } catch (error) {
    console.error('Error ensuring comments file:', error);
  }
}

// Read comments from file
async function readComments(): Promise<DayComment[]> {
  try {
    await ensureCommentsFile();
    const data = await fs.readFile(COMMENTS_FILE, 'utf-8');
    const comments = JSON.parse(data);
    // Convert date strings back to Date objects
    return comments.map((comment: any) => ({
      ...comment,
      createdAt: new Date(comment.createdAt),
      updatedAt: new Date(comment.updatedAt)
    }));
  } catch (error) {
    console.error('Error reading comments:', error);
    return [];
  }
}

// Write comments to file
async function writeComments(comments: DayComment[]): Promise<void> {
  try {
    await ensureCommentsFile();
    await fs.writeFile(COMMENTS_FILE, JSON.stringify(comments, null, 2));
  } catch (error) {
    console.error('Error writing comments:', error);
    throw error;
  }
}

// GET - Fetch comments for specific booking IDs
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const bookingIds = searchParams.get('bookingIds');
    const apartmentName = searchParams.get('apartmentName');

    const comments = await readComments();
    
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
    return NextResponse.json(
      { error: 'Error al obtener los comentarios' },
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

    const comments = await readComments();
    
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
    
    await writeComments(comments);

    return NextResponse.json({
      comment: newComment,
      message: existingIndex >= 0 ? 'Comentario actualizado exitosamente' : 'Comentario creado exitosamente'
    }, { status: existingIndex >= 0 ? 200 : 201 });

  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json(
      { error: 'Error al crear el comentario' },
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

    const comments = await readComments();
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

    await writeComments(comments);

    return NextResponse.json({
      comment: comments[commentIndex],
      message: 'Comentario actualizado exitosamente'
    });

  } catch (error) {
    console.error('Error updating comment:', error);
    return NextResponse.json(
      { error: 'Error al actualizar el comentario' },
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

    const comments = await readComments();
    const commentIndex = comments.findIndex(comment => comment.bookingId === bookingId);

    if (commentIndex === -1) {
      return NextResponse.json(
        { error: 'Comentario no encontrado para este booking' },
        { status: 404 }
      );
    }

    // Remove the comment
    const deletedComment = comments.splice(commentIndex, 1)[0];
    await writeComments(comments);

    return NextResponse.json({
      comment: deletedComment,
      message: 'Comentario eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error deleting comment:', error);
    return NextResponse.json(
      { error: 'Error al eliminar el comentario' },
      { status: 500 }
    );
  }
}