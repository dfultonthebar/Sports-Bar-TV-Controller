
/**
 * Sports Guide API - Channels Endpoint
 * 
 * Fetches channel guide data from Sports Guide API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSportsGuideApi } from '@/lib/sportsGuideApi';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('start_date') || undefined;
    const endDate = searchParams.get('end_date') || undefined;
    const lineup = searchParams.get('lineup') || undefined;
    const search = searchParams.get('search') || undefined;
    const days = searchParams.get('days') ? parseInt(searchParams.get('days')!) : undefined;

    const api = getSportsGuideApi();
    let guide;

    // Fetch guide based on parameters
    if (days) {
      guide = await api.fetchDateRangeGuide(days);
    } else if (startDate && endDate) {
      guide = await api.fetchGuide(startDate, endDate);
    } else if (startDate) {
      guide = await api.fetchGuide(startDate, startDate);
    } else {
      guide = await api.fetchTodayGuide();
    }

    // Filter by search term if provided
    if (search) {
      const searchResults = api.searchGuide(guide, search);
      guide = {
        listing_groups: searchResults,
      };
    }

    // Filter by lineup if provided
    let channels = undefined;
    if (lineup) {
      channels = api.getChannelsByLineup(guide, lineup);
    }

    return NextResponse.json({
      success: true,
      guide,
      channels,
      filters: {
        startDate,
        endDate,
        lineup,
        search,
        days,
      },
    });
  } catch (error) {
    console.error('Error fetching Sports Guide channels:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch channel guide',
      },
      { status: 500 }
    );
  }
}
