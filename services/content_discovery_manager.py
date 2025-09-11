
#!/usr/bin/env python3
"""
Content Discovery Manager - Orchestrates sports content discovery and deep linking
Combines schedule fetching with deep link generation for seamless user experience
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass

from .sports_schedule_service import SportsScheduleService, SportsEvent, StreamingProvider
from .deep_link_builder import DeepLinkBuilder, StreamingApp, Platform

logger = logging.getLogger(__name__)

@dataclass
class ContentRecommendation:
    """Represents a content recommendation with deep link"""
    event: SportsEvent
    deep_link: str
    priority: int = 0
    reason: str = ""

class ContentDiscoveryManager:
    """
    Manager class that orchestrates content discovery and deep linking
    """
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.schedule_service = SportsScheduleService(config.get('sports_api', {}))
        self.deep_link_builder = DeepLinkBuilder()
        
        # Platform preference (can be configured)
        self.default_platform = Platform.FIRE_TV
        
        # Provider to app mapping
        self.provider_app_mapping = {
            StreamingProvider.PRIME_VIDEO: StreamingApp.PRIME_VIDEO,
            StreamingProvider.ESPN_PLUS: StreamingApp.ESPN,
            StreamingProvider.PARAMOUNT_PLUS: StreamingApp.PARAMOUNT_PLUS,
            StreamingProvider.PEACOCK: StreamingApp.PEACOCK,
            StreamingProvider.APPLE_TV: StreamingApp.APPLE_TV_APP
        }
        
        logger.info("Content Discovery Manager initialized")
    
    async def get_live_content_recommendations(self, 
                                             max_results: int = 10,
                                             preferred_sports: Optional[List[str]] = None) -> List[ContentRecommendation]:
        """
        Get recommendations for currently live sports content
        
        Args:
            max_results: Maximum number of recommendations to return
            preferred_sports: List of preferred sports (e.g., ['football', 'basketball'])
            
        Returns:
            List of content recommendations with deep links
        """
        try:
            # Fetch live events
            live_events = await self.schedule_service.get_live_events()
            
            recommendations = []
            
            for event in live_events:
                # Apply sport preferences
                if preferred_sports and event.sport.lower() not in [s.lower() for s in preferred_sports]:
                    continue
                
                # Generate deep link
                deep_link = self._generate_deep_link_for_event(event)
                if not deep_link:
                    continue
                
                # Calculate priority
                priority = self._calculate_priority(event, is_live=True)
                
                recommendation = ContentRecommendation(
                    event=event,
                    deep_link=deep_link,
                    priority=priority,
                    reason=f"Live {event.sport} game: {event.home_team} vs {event.away_team}"
                )
                
                recommendations.append(recommendation)
            
            # Sort by priority and limit results
            recommendations.sort(key=lambda x: x.priority, reverse=True)
            return recommendations[:max_results]
            
        except Exception as e:
            logger.error(f"Error getting live content recommendations: {e}")
            return []
    
    async def get_upcoming_content_recommendations(self, 
                                                 hours_ahead: int = 24,
                                                 max_results: int = 20,
                                                 preferred_sports: Optional[List[str]] = None) -> List[ContentRecommendation]:
        """
        Get recommendations for upcoming sports content
        
        Args:
            hours_ahead: How many hours ahead to look for content
            max_results: Maximum number of recommendations to return
            preferred_sports: List of preferred sports
            
        Returns:
            List of content recommendations with deep links
        """
        try:
            # Fetch upcoming events
            upcoming_events = await self.schedule_service.get_upcoming_events(hours_ahead=hours_ahead)
            
            recommendations = []
            
            for event in upcoming_events:
                # Apply sport preferences
                if preferred_sports and event.sport.lower() not in [s.lower() for s in preferred_sports]:
                    continue
                
                # Generate deep link
                deep_link = self._generate_deep_link_for_event(event)
                if not deep_link:
                    continue
                
                # Calculate priority
                priority = self._calculate_priority(event, is_live=False)
                
                # Create reason based on timing
                time_until = event.start_time - datetime.now()
                if time_until.total_seconds() < 3600:  # Less than 1 hour
                    reason = f"Starting soon: {event.home_team} vs {event.away_team}"
                elif time_until.days == 0:  # Today
                    reason = f"Today at {event.start_time.strftime('%I:%M %p')}: {event.home_team} vs {event.away_team}"
                else:
                    reason = f"{event.start_time.strftime('%m/%d at %I:%M %p')}: {event.home_team} vs {event.away_team}"
                
                recommendation = ContentRecommendation(
                    event=event,
                    deep_link=deep_link,
                    priority=priority,
                    reason=reason
                )
                
                recommendations.append(recommendation)
            
            # Sort by priority and limit results
            recommendations.sort(key=lambda x: x.priority, reverse=True)
            return recommendations[:max_results]
            
        except Exception as e:
            logger.error(f"Error getting upcoming content recommendations: {e}")
            return []
    
    async def search_content(self, 
                           query: str,
                           max_results: int = 15) -> List[ContentRecommendation]:
        """
        Search for sports content based on query
        
        Args:
            query: Search query (team name, league, sport, etc.)
            max_results: Maximum number of results to return
            
        Returns:
            List of matching content recommendations
        """
        try:
            # Search events
            matching_events = await self.schedule_service.search_events(query)
            
            recommendations = []
            
            for event in matching_events:
                # Generate deep link
                deep_link = self._generate_deep_link_for_event(event)
                if not deep_link:
                    continue
                
                # Calculate priority based on relevance and timing
                priority = self._calculate_search_priority(event, query)
                
                recommendation = ContentRecommendation(
                    event=event,
                    deep_link=deep_link,
                    priority=priority,
                    reason=f"Match for '{query}': {event.title}"
                )
                
                recommendations.append(recommendation)
            
            # Sort by priority and limit results
            recommendations.sort(key=lambda x: x.priority, reverse=True)
            return recommendations[:max_results]
            
        except Exception as e:
            logger.error(f"Error searching content: {e}")
            return []
    
    async def get_featured_content(self, 
                                 category: str = "trending",
                                 max_results: int = 8) -> List[ContentRecommendation]:
        """
        Get featured content based on category
        
        Args:
            category: Category of content (trending, popular, prime_time, etc.)
            max_results: Maximum number of results to return
            
        Returns:
            List of featured content recommendations
        """
        try:
            if category == "trending":
                return await self._get_trending_content(max_results)
            elif category == "prime_time":
                return await self._get_prime_time_content(max_results)
            elif category == "weekend":
                return await self._get_weekend_content(max_results)
            else:
                # Default to live + upcoming
                live_content = await self.get_live_content_recommendations(max_results // 2)
                upcoming_content = await self.get_upcoming_content_recommendations(
                    hours_ahead=6, 
                    max_results=max_results // 2
                )
                return live_content + upcoming_content
                
        except Exception as e:
            logger.error(f"Error getting featured content: {e}")
            return []
    
    def _generate_deep_link_for_event(self, event: SportsEvent) -> Optional[str]:
        """Generate deep link for a sports event"""
        try:
            # Map provider to streaming app
            streaming_app = self.provider_app_mapping.get(event.provider)
            if not streaming_app:
                logger.warning(f"No app mapping for provider {event.provider}")
                return None
            
            # Extract content ID from event
            content_id = self._extract_content_id(event)
            
            # Build sports-specific deep link
            deep_link = self.deep_link_builder.build_sports_deep_link(
                app=streaming_app,
                platform=self.default_platform,
                sport=event.sport,
                league=event.league,
                team1=event.home_team,
                team2=event.away_team,
                game_id=content_id,
                is_live=event.is_live
            )
            
            return deep_link
            
        except Exception as e:
            logger.error(f"Error generating deep link for event {event.id}: {e}")
            return None
    
    def _extract_content_id(self, event: SportsEvent) -> Optional[str]:
        """Extract content ID from event ID"""
        try:
            # Event IDs are formatted as "provider_type_id"
            parts = event.id.split('_')
            if len(parts) >= 3:
                return parts[-1]  # Last part is usually the content ID
            return None
        except Exception:
            return None
    
    def _calculate_priority(self, event: SportsEvent, is_live: bool) -> int:
        """Calculate priority score for an event"""
        priority = 0
        
        # Base priority for live events
        if is_live:
            priority += 100
        
        # Priority based on sport popularity (can be configured)
        sport_priorities = {
            'football': 50,
            'basketball': 40,
            'baseball': 30,
            'hockey': 25,
            'soccer': 35
        }
        priority += sport_priorities.get(event.sport.lower(), 10)
        
        # Priority based on league importance
        league_priorities = {
            'nfl': 50,
            'nba': 40,
            'mlb': 30,
            'nhl': 25,
            'mls': 20,
            'premier league': 35
        }
        priority += league_priorities.get(event.league.lower(), 10)
        
        # Time-based priority for upcoming events
        if not is_live:
            time_until = event.start_time - datetime.now()
            hours_until = time_until.total_seconds() / 3600
            
            if hours_until < 1:
                priority += 30  # Starting very soon
            elif hours_until < 3:
                priority += 20  # Starting soon
            elif hours_until < 6:
                priority += 10  # Starting today
        
        return priority
    
    def _calculate_search_priority(self, event: SportsEvent, query: str) -> int:
        """Calculate priority for search results"""
        priority = self._calculate_priority(event, event.is_live)
        
        # Boost priority based on query relevance
        query_lower = query.lower()
        
        # Exact team name match
        if (query_lower in event.home_team.lower() or 
            query_lower in event.away_team.lower()):
            priority += 50
        
        # League match
        if query_lower in event.league.lower():
            priority += 30
        
        # Sport match
        if query_lower in event.sport.lower():
            priority += 20
        
        return priority
    
    async def _get_trending_content(self, max_results: int) -> List[ContentRecommendation]:
        """Get trending sports content"""
        # Combine live and high-priority upcoming events
        live_content = await self.get_live_content_recommendations(max_results // 2)
        upcoming_content = await self.get_upcoming_content_recommendations(
            hours_ahead=12, 
            max_results=max_results // 2,
            preferred_sports=['football', 'basketball']  # Popular sports
        )
        
        all_content = live_content + upcoming_content
        all_content.sort(key=lambda x: x.priority, reverse=True)
        
        return all_content[:max_results]
    
    async def _get_prime_time_content(self, max_results: int) -> List[ContentRecommendation]:
        """Get prime time sports content (evening games)"""
        upcoming_events = await self.schedule_service.get_upcoming_events(hours_ahead=24)
        
        recommendations = []
        
        for event in upcoming_events:
            # Check if event is in prime time (6 PM - 11 PM)
            event_hour = event.start_time.hour
            if 18 <= event_hour <= 23:  # 6 PM to 11 PM
                deep_link = self._generate_deep_link_for_event(event)
                if deep_link:
                    priority = self._calculate_priority(event, event.is_live) + 25  # Prime time bonus
                    
                    recommendation = ContentRecommendation(
                        event=event,
                        deep_link=deep_link,
                        priority=priority,
                        reason=f"Prime time game: {event.home_team} vs {event.away_team}"
                    )
                    recommendations.append(recommendation)
        
        recommendations.sort(key=lambda x: x.priority, reverse=True)
        return recommendations[:max_results]
    
    async def _get_weekend_content(self, max_results: int) -> List[ContentRecommendation]:
        """Get weekend sports content"""
        upcoming_events = await self.schedule_service.get_upcoming_events(hours_ahead=72)  # 3 days
        
        recommendations = []
        
        for event in upcoming_events:
            # Check if event is on weekend (Saturday or Sunday)
            if event.start_time.weekday() in [5, 6]:  # Saturday = 5, Sunday = 6
                deep_link = self._generate_deep_link_for_event(event)
                if deep_link:
                    priority = self._calculate_priority(event, event.is_live) + 15  # Weekend bonus
                    
                    recommendation = ContentRecommendation(
                        event=event,
                        deep_link=deep_link,
                        priority=priority,
                        reason=f"Weekend game: {event.home_team} vs {event.away_team}"
                    )
                    recommendations.append(recommendation)
        
        recommendations.sort(key=lambda x: x.priority, reverse=True)
        return recommendations[:max_results]

