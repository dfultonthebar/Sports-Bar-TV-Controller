
#!/usr/bin/env python3
"""
Sports Schedule Service - Content Discovery for Streaming Services
Fetches live sports schedules and content from various streaming platforms
"""

import asyncio
import logging
import json
import requests
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from enum import Enum

logger = logging.getLogger(__name__)

class StreamingProvider(Enum):
    PRIME_VIDEO = "prime_video"
    ESPN_PLUS = "espn_plus"
    PARAMOUNT_PLUS = "paramount_plus"
    PEACOCK = "peacock"
    APPLE_TV = "apple_tv"

@dataclass
class SportsEvent:
    """Represents a sports event with streaming information"""
    id: str
    title: str
    description: str
    sport: str
    league: str
    home_team: str
    away_team: str
    start_time: datetime
    end_time: datetime
    provider: StreamingProvider
    deep_link_url: str
    is_live: bool = False
    thumbnail_url: Optional[str] = None
    content_rating: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        data = asdict(self)
        data['start_time'] = self.start_time.isoformat()
        data['end_time'] = self.end_time.isoformat()
        data['provider'] = self.provider.value
        return data

class SportsScheduleService:
    """
    Service for fetching sports schedules and content from streaming providers
    """
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.api_keys = config.get('api_keys', {})
        self.cache_duration = config.get('cache_duration_minutes', 30)
        self._cache = {}
        self._cache_timestamps = {}
        
        # Initialize API clients
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Sports-Bar-TV-Controller/1.0'
        })
        
        logger.info("Sports Schedule Service initialized")
    
    async def get_live_events(self, providers: Optional[List[StreamingProvider]] = None) -> List[SportsEvent]:
        """Get currently live sports events"""
        if providers is None:
            providers = list(StreamingProvider)
        
        live_events = []
        for provider in providers:
            try:
                events = await self._fetch_provider_events(provider, live_only=True)
                live_events.extend(events)
            except Exception as e:
                logger.error(f"Failed to fetch live events from {provider.value}: {e}")
        
        return sorted(live_events, key=lambda x: x.start_time)
    
    async def get_upcoming_events(self, 
                                 providers: Optional[List[StreamingProvider]] = None,
                                 hours_ahead: int = 24) -> List[SportsEvent]:
        """Get upcoming sports events within specified time window"""
        if providers is None:
            providers = list(StreamingProvider)
        
        upcoming_events = []
        end_time = datetime.now() + timedelta(hours=hours_ahead)
        
        for provider in providers:
            try:
                events = await self._fetch_provider_events(provider, end_time=end_time)
                upcoming_events.extend(events)
            except Exception as e:
                logger.error(f"Failed to fetch upcoming events from {provider.value}: {e}")
        
        return sorted(upcoming_events, key=lambda x: x.start_time)
    
    async def search_events(self, query: str, providers: Optional[List[StreamingProvider]] = None) -> List[SportsEvent]:
        """Search for sports events by team, league, or sport"""
        if providers is None:
            providers = list(StreamingProvider)
        
        all_events = []
        for provider in providers:
            try:
                events = await self._fetch_provider_events(provider)
                # Filter events based on search query
                filtered_events = [
                    event for event in events
                    if query.lower() in event.title.lower() or
                       query.lower() in event.home_team.lower() or
                       query.lower() in event.away_team.lower() or
                       query.lower() in event.league.lower() or
                       query.lower() in event.sport.lower()
                ]
                all_events.extend(filtered_events)
            except Exception as e:
                logger.error(f"Failed to search events from {provider.value}: {e}")
        
        return sorted(all_events, key=lambda x: x.start_time)
    
    async def _fetch_provider_events(self, 
                                   provider: StreamingProvider,
                                   live_only: bool = False,
                                   end_time: Optional[datetime] = None) -> List[SportsEvent]:
        """Fetch events from a specific streaming provider"""
        cache_key = f"{provider.value}_{live_only}_{end_time}"
        
        # Check cache
        if self._is_cache_valid(cache_key):
            return self._cache[cache_key]
        
        events = []
        
        if provider == StreamingProvider.PRIME_VIDEO:
            events = await self._fetch_prime_video_events(live_only, end_time)
        elif provider == StreamingProvider.ESPN_PLUS:
            events = await self._fetch_espn_plus_events(live_only, end_time)
        elif provider == StreamingProvider.PARAMOUNT_PLUS:
            events = await self._fetch_paramount_plus_events(live_only, end_time)
        elif provider == StreamingProvider.PEACOCK:
            events = await self._fetch_peacock_events(live_only, end_time)
        elif provider == StreamingProvider.APPLE_TV:
            events = await self._fetch_apple_tv_events(live_only, end_time)
        
        # Cache the results
        self._cache[cache_key] = events
        self._cache_timestamps[cache_key] = datetime.now()
        
        return events
    
    async def _fetch_prime_video_events(self, live_only: bool = False, end_time: Optional[datetime] = None) -> List[SportsEvent]:
        """Fetch Prime Video sports events (Thursday Night Football, etc.)"""
        events = []
        
        try:
            # Use API-Sports for NFL data (Thursday Night Football)
            api_key = self.api_keys.get('api_sports')
            if not api_key:
                logger.warning("API-Sports key not configured for Prime Video events")
                return events
            
            headers = {
                'X-RapidAPI-Key': api_key,
                'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
            }
            
            # Get NFL fixtures
            url = "https://api-football-v1.p.rapidapi.com/v3/fixtures"
            params = {
                'league': '1',  # NFL league ID
                'season': datetime.now().year,
                'status': 'NS-1H-HT-2H-ET-P-FT' if not live_only else '1H-HT-2H'
            }
            
            if end_time:
                params['to'] = end_time.strftime('%Y-%m-%d')
            
            response = self.session.get(url, headers=headers, params=params)
            response.raise_for_status()
            
            data = response.json()
            
            for fixture in data.get('response', []):
                # Check if it's a Thursday Night Football game
                fixture_date = datetime.fromisoformat(fixture['fixture']['date'].replace('Z', '+00:00'))
                is_thursday = fixture_date.weekday() == 3  # Thursday
                
                if is_thursday:  # Thursday Night Football on Prime Video
                    event = SportsEvent(
                        id=f"prime_tnf_{fixture['fixture']['id']}",
                        title=f"Thursday Night Football: {fixture['teams']['home']['name']} vs {fixture['teams']['away']['name']}",
                        description=f"NFL Thursday Night Football - {fixture['league']['name']}",
                        sport="Football",
                        league="NFL",
                        home_team=fixture['teams']['home']['name'],
                        away_team=fixture['teams']['away']['name'],
                        start_time=fixture_date,
                        end_time=fixture_date + timedelta(hours=3),
                        provider=StreamingProvider.PRIME_VIDEO,
                        deep_link_url=f"amzns://apps/android?asin=B00ZV9RDKK#Intent;action=android.intent.action.VIEW;S.contentId=tnf_{fixture['fixture']['id']};end",
                        is_live=fixture['fixture']['status']['short'] in ['1H', 'HT', '2H'],
                        thumbnail_url=fixture['teams']['home'].get('logo')
                    )
                    events.append(event)
            
        except Exception as e:
            logger.error(f"Error fetching Prime Video events: {e}")
        
        return events
    
    async def _fetch_espn_plus_events(self, live_only: bool = False, end_time: Optional[datetime] = None) -> List[SportsEvent]:
        """Fetch ESPN+ sports events"""
        events = []
        
        try:
            # Use SportsDataIO for comprehensive sports data
            api_key = self.api_keys.get('sportsdata_io')
            if not api_key:
                logger.warning("SportsDataIO key not configured for ESPN+ events")
                return events
            
            # Fetch from multiple leagues available on ESPN+
            leagues = ['nba', 'mlb', 'nhl', 'mls']
            
            for league in leagues:
                try:
                    url = f"https://api.sportsdata.io/v3/{league}/scores/json/GamesByDate/{datetime.now().strftime('%Y-%m-%d')}"
                    headers = {'Ocp-Apim-Subscription-Key': api_key}
                    
                    response = self.session.get(url, headers=headers)
                    response.raise_for_status()
                    
                    games = response.json()
                    
                    for game in games:
                        if live_only and game.get('Status') not in ['InProgress', 'Halftime']:
                            continue
                        
                        start_time = datetime.fromisoformat(game['DateTime'])
                        if end_time and start_time > end_time:
                            continue
                        
                        event = SportsEvent(
                            id=f"espn_plus_{league}_{game['GameID']}",
                            title=f"{game['HomeTeam']} vs {game['AwayTeam']}",
                            description=f"{league.upper()} Game on ESPN+",
                            sport=league.upper(),
                            league=league.upper(),
                            home_team=game['HomeTeam'],
                            away_team=game['AwayTeam'],
                            start_time=start_time,
                            end_time=start_time + timedelta(hours=3),
                            provider=StreamingProvider.ESPN_PLUS,
                            deep_link_url=f"espn://game/{game['GameID']}",
                            is_live=game.get('Status') in ['InProgress', 'Halftime'],
                            content_rating="TV-PG"
                        )
                        events.append(event)
                        
                except Exception as e:
                    logger.error(f"Error fetching {league} events from ESPN+: {e}")
            
        except Exception as e:
            logger.error(f"Error fetching ESPN+ events: {e}")
        
        return events
    
    async def _fetch_paramount_plus_events(self, live_only: bool = False, end_time: Optional[datetime] = None) -> List[SportsEvent]:
        """Fetch Paramount+ sports events (CBS Sports, UEFA Champions League, etc.)"""
        events = []
        
        # Placeholder for Paramount+ specific implementation
        # Would integrate with CBS Sports API or similar
        logger.info("Paramount+ events fetching - placeholder implementation")
        
        return events
    
    async def _fetch_peacock_events(self, live_only: bool = False, end_time: Optional[datetime] = None) -> List[SportsEvent]:
        """Fetch Peacock sports events (Premier League, Olympics, etc.)"""
        events = []
        
        # Placeholder for Peacock specific implementation
        # Would integrate with NBC Sports API or similar
        logger.info("Peacock events fetching - placeholder implementation")
        
        return events
    
    async def _fetch_apple_tv_events(self, live_only: bool = False, end_time: Optional[datetime] = None) -> List[SportsEvent]:
        """Fetch Apple TV+ sports events (MLS Season Pass, MLB Friday Night Baseball)"""
        events = []
        
        # Placeholder for Apple TV+ specific implementation
        # Would integrate with MLS or MLB APIs
        logger.info("Apple TV+ events fetching - placeholder implementation")
        
        return events
    
    def _is_cache_valid(self, cache_key: str) -> bool:
        """Check if cached data is still valid"""
        if cache_key not in self._cache_timestamps:
            return False
        
        cache_time = self._cache_timestamps[cache_key]
        return (datetime.now() - cache_time).total_seconds() < (self.cache_duration * 60)
    
    def clear_cache(self):
        """Clear all cached data"""
        self._cache.clear()
        self._cache_timestamps.clear()
        logger.info("Sports schedule cache cleared")

