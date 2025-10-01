
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET - List all home teams
export async function GET(request: NextRequest) {
  try {
    const teams = await prisma.homeTeam.findMany({
      where: { isActive: true },
      orderBy: [
        { isPrimary: 'desc' },
        { teamName: 'asc' }
      ]
    });

    return NextResponse.json({ teams });
  } catch (error: any) {
    console.error('Error fetching home teams:', error);
    return NextResponse.json(
      { error: 'Failed to fetch home teams', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Create new home team
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const team = await prisma.homeTeam.create({
      data: {
        teamName: body.teamName,
        league: body.league || '',
        category: body.category || 'professional',
        sport: body.sport || 'football',
        location: body.location || null,
        conference: body.conference || null,
        isPrimary: body.isPrimary || false,
        isActive: body.isActive !== undefined ? body.isActive : true
      }
    });

    return NextResponse.json({ team }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating home team:', error);
    return NextResponse.json(
      { error: 'Failed to create home team', details: error.message },
      { status: 500 }
    );
  }
}
