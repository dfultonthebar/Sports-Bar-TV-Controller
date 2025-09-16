
#!/usr/bin/env python3
"""
Unit tests for sports content discovery services
"""

import unittest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, AsyncMock

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.sports_schedule_service import SportsScheduleService, SportsEvent, StreamingProvider
from services.deep_link_builder import DeepLinkBuilder, StreamingApp, Platform
from services.content_discovery_manager import ContentDiscoveryManager

class TestSportsScheduleService(unittest.TestCase):
    """Test cases for SportsScheduleService"""
    
    def setUp(self):
        self.config = {
            'api_keys': {
                'api_sports': 'test_key',
                'sportsdata_io': 'test_key'
            },
            'cache_duration_minutes': 30
        }
        self.service = SportsScheduleService(self.config)
    
    def test_initialization(self):
        """Test service initialization"""
        self.assertIsNotNone(self.service)
        self.assertEqual(self.service.cache_duration, 30)
        self.assertIn('api_sports', self.service.api_keys)
    
    def test_sports_event_creation(self):
        """Test SportsEvent dataclass"""
        start_time = datetime.now()
        end_time = start_time + timedelta(hours=3)
        
        event = SportsEvent(
            id="test_event_1",
            title="Test Game",
            description="Test Description",
            sport="Football",
            league="NFL",
            home_team="Team A",
            away_team="Team B",
            start_time=start_time,
            end_time=end_time,
            provider=StreamingProvider.PRIME_VIDEO,
            deep_link_url="test://link",
            is_live=True
        )
        
        self.assertEqual(event.id, "test_event_1")
        self.assertEqual(event.sport, "Football")
        self.assertTrue(event.is_live)
        
        # Test to_dict conversion
        event_dict = event.to_dict()
        self.assertIn('start_time', event_dict)
        self.assertEqual(event_dict['provider'], 'prime_video')
    
    def test_cache_validation(self):
        """Test cache validation logic"""
        cache_key = "test_key"
        
        # Initially invalid
        self.assertFalse(self.service._is_cache_valid(cache_key))
        
        # Add to cache
        self.service._cache[cache_key] = []
        self.service._cache_timestamps[cache_key] = datetime.now()
        
        # Should be valid now
        self.assertTrue(self.service._is_cache_valid(cache_key))
        
        # Make it expired
        self.service._cache_timestamps[cache_key] = datetime.now() - timedelta(hours=1)
        self.assertFalse(self.service._is_cache_valid(cache_key))
    
    def test_clear_cache(self):
        """Test cache clearing"""
        self.service._cache['test'] = []
        self.service._cache_timestamps['test'] = datetime.now()
        
        self.service.clear_cache()
        
        self.assertEqual(len(self.service._cache), 0)
        self.assertEqual(len(self.service._cache_timestamps), 0)

class TestDeepLinkBuilder(unittest.TestCase):
    """Test cases for DeepLinkBuilder"""
    
    def setUp(self):
        self.builder = DeepLinkBuilder()
    
    def test_initialization(self):
        """Test builder initialization"""
        self.assertIsNotNone(self.builder)
        self.assertIn(StreamingApp.PRIME_VIDEO.value, self.builder.app_configs)
    
    def test_fire_tv_deep_link_generation(self):
        """Test Fire TV deep link generation"""
        deep_link = self.builder.build_deep_link(
            app=StreamingApp.PRIME_VIDEO,
            platform=Platform.FIRE_TV,
            content_id="test_content_123"
        )
        
        self.assertIsNotNone(deep_link)
        self.assertIn("amzns://", deep_link)
        self.assertIn("B00ZV9RDKK", deep_link)  # Prime Video ASIN
    
    def test_android_tv_deep_link_generation(self):
        """Test Android TV deep link generation"""
        deep_link = self.builder.build_deep_link(
            app=StreamingApp.ESPN,
            platform=Platform.ANDROID_TV,
            content_id="game_456"
        )
        
        self.assertIsNotNone(deep_link)
        # Should use URL scheme for Android TV
        self.assertTrue(deep_link.startswith("espn://") or "intent:" in deep_link)
    
    def test_sports_deep_link_generation(self):
        """Test sports-specific deep link generation"""
        deep_link = self.builder.build_sports_deep_link(
            app=StreamingApp.ESPN,
            platform=Platform.FIRE_TV,
            sport="football",
            league="NFL",
            team1="Patriots",
            team2="Chiefs",
            game_id="nfl_game_789",
            is_live=True
        )
        
        self.assertIsNotNone(deep_link)
        self.assertIn("amzns://", deep_link)
    
    def test_deep_link_validation(self):
        """Test deep link validation"""
        # Valid deep links
        valid_links = [
            "amzns://apps/android?asin=B123#Intent;action=view;end",
            "espn://game/123",
            "aiv://video/456"
        ]
        
        for link in valid_links:
            self.assertTrue(self.builder.validate_deep_link(link))
        
        # Invalid deep links
        invalid_links = [
            "",
            "http://example.com",
            "invalid://scheme"
        ]
        
        for link in invalid_links:
            self.assertFalse(self.builder.validate_deep_link(link))
    
    def test_supported_apps(self):
        """Test getting supported apps for platform"""
        fire_tv_apps = self.builder.get_supported_apps(Platform.FIRE_TV)
        self.assertIn(StreamingApp.PRIME_VIDEO, fire_tv_apps)
        self.assertIn(StreamingApp.ESPN, fire_tv_apps)

class TestContentDiscoveryManager(unittest.TestCase):
    """Test cases for ContentDiscoveryManager"""
    
    def setUp(self):
        self.config = {
            'sports_api': {
                'api_keys': {
                    'api_sports': 'test_key',
                    'sportsdata_io': 'test_key'
                }
            }
        }
        self.manager = ContentDiscoveryManager(self.config)
    
    def test_initialization(self):
        """Test manager initialization"""
        self.assertIsNotNone(self.manager)
        self.assertIsNotNone(self.manager.schedule_service)
        self.assertIsNotNone(self.manager.deep_link_builder)
        self.assertEqual(self.manager.default_platform, Platform.FIRE_TV)
    
    def test_provider_app_mapping(self):
        """Test provider to app mapping"""
        self.assertEqual(
            self.manager.provider_app_mapping[StreamingProvider.PRIME_VIDEO],
            StreamingApp.PRIME_VIDEO
        )
        self.assertEqual(
            self.manager.provider_app_mapping[StreamingProvider.ESPN_PLUS],
            StreamingApp.ESPN
        )
    
    def test_content_id_extraction(self):
        """Test content ID extraction from event ID"""
        event_id = "prime_tnf_12345"
        content_id = self.manager._extract_content_id(
            Mock(id=event_id)
        )
        self.assertEqual(content_id, "12345")
        
        # Test with invalid format
        invalid_event = Mock(id="invalid")
        content_id = self.manager._extract_content_id(invalid_event)
        self.assertIsNone(content_id)
    
    def test_priority_calculation(self):
        """Test priority calculation for events"""
        # Create mock event
        event = Mock()
        event.sport = "football"
        event.league = "NFL"
        event.start_time = datetime.now() + timedelta(minutes=30)
        
        # Test live event priority
        live_priority = self.manager._calculate_priority(event, is_live=True)
        self.assertGreater(live_priority, 100)  # Should have live bonus
        
        # Test upcoming event priority
        upcoming_priority = self.manager._calculate_priority(event, is_live=False)
        self.assertLess(upcoming_priority, live_priority)
        self.assertGreater(upcoming_priority, 50)  # Should have sport/league bonus
    
    def test_search_priority_calculation(self):
        """Test search priority calculation"""
        event = Mock()
        event.sport = "football"
        event.league = "NFL"
        event.home_team = "Patriots"
        event.away_team = "Chiefs"
        event.start_time = datetime.now()
        event.is_live = False
        
        # Test exact team match
        priority = self.manager._calculate_search_priority(event, "Patriots")
        base_priority = self.manager._calculate_priority(event, False)
        self.assertGreater(priority, base_priority)
        
        # Test league match
        league_priority = self.manager._calculate_search_priority(event, "NFL")
        self.assertGreater(league_priority, base_priority)

class AsyncTestCase(unittest.TestCase):
    """Base class for async test cases"""
    
    def setUp(self):
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)
    
    def tearDown(self):
        self.loop.close()
    
    def run_async(self, coro):
        return self.loop.run_until_complete(coro)

class TestAsyncContentDiscovery(AsyncTestCase):
    """Test async methods of ContentDiscoveryManager"""
    
    def setUp(self):
        super().setUp()
        self.config = {
            'sports_api': {
                'api_keys': {
                    'api_sports': 'test_key',
                    'sportsdata_io': 'test_key'
                }
            }
        }
        self.manager = ContentDiscoveryManager(self.config)
    
    @patch('services.content_discovery_manager.ContentDiscoveryManager._generate_deep_link_for_event')
    async def test_get_live_content_recommendations(self, mock_deep_link):
        """Test getting live content recommendations"""
        # Mock the schedule service
        mock_event = Mock()
        mock_event.sport = "football"
        mock_event.home_team = "Team A"
        mock_event.away_team = "Team B"
        mock_event.is_live = True
        
        mock_deep_link.return_value = "test://deep_link"
        
        with patch.object(self.manager.schedule_service, 'get_live_events', 
                         new_callable=AsyncMock) as mock_get_live:
            mock_get_live.return_value = [mock_event]
            
            recommendations = await self.manager.get_live_content_recommendations(max_results=5)
            
            self.assertEqual(len(recommendations), 1)
            self.assertEqual(recommendations[0].deep_link, "test://deep_link")
    
    async def test_search_content_empty_query(self):
        """Test search with empty query"""
        with patch.object(self.manager.schedule_service, 'search_events',
                         new_callable=AsyncMock) as mock_search:
            mock_search.return_value = []
            
            recommendations = await self.manager.search_content("")
            
            # Should still call search_events but return empty results
            mock_search.assert_called_once()
            self.assertEqual(len(recommendations), 0)

if __name__ == '__main__':
    # Run the tests
    unittest.main(verbosity=2)

