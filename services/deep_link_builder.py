
#!/usr/bin/env python3
"""
Deep Link Builder - Generate deep links for streaming services
Creates platform-specific deep links for Fire TV and other devices
"""

import logging
import urllib.parse
from typing import Dict, Optional, Any
from enum import Enum
from dataclasses import dataclass

logger = logging.getLogger(__name__)

class Platform(Enum):
    FIRE_TV = "fire_tv"
    ANDROID_TV = "android_tv"
    ROKU = "roku"
    APPLE_TV = "apple_tv"

class StreamingApp(Enum):
    PRIME_VIDEO = "prime_video"
    ESPN = "espn"
    PARAMOUNT_PLUS = "paramount_plus"
    PEACOCK = "peacock"
    APPLE_TV_APP = "apple_tv_app"
    NETFLIX = "netflix"
    HULU = "hulu"

@dataclass
class DeepLinkConfig:
    """Configuration for deep link generation"""
    app: StreamingApp
    platform: Platform
    package_name: str
    activity_name: Optional[str] = None
    url_scheme: Optional[str] = None
    asin: Optional[str] = None  # Amazon-specific

class DeepLinkBuilder:
    """
    Builder class for generating deep links to streaming content
    """
    
    def __init__(self):
        self.app_configs = self._initialize_app_configs()
        logger.info("Deep Link Builder initialized")
    
    def _initialize_app_configs(self) -> Dict[str, Dict[Platform, DeepLinkConfig]]:
        """Initialize app configuration for different platforms"""
        return {
            StreamingApp.PRIME_VIDEO.value: {
                Platform.FIRE_TV: DeepLinkConfig(
                    app=StreamingApp.PRIME_VIDEO,
                    platform=Platform.FIRE_TV,
                    package_name="com.amazon.avod.thirdpartyclient",
                    activity_name="com.amazon.ignition.core.player.LauncherActivity",
                    url_scheme="aiv",
                    asin="B00ZV9RDKK"
                ),
                Platform.ANDROID_TV: DeepLinkConfig(
                    app=StreamingApp.PRIME_VIDEO,
                    platform=Platform.ANDROID_TV,
                    package_name="com.amazon.avod.thirdpartyclient",
                    url_scheme="aiv"
                )
            },
            StreamingApp.ESPN.value: {
                Platform.FIRE_TV: DeepLinkConfig(
                    app=StreamingApp.ESPN,
                    platform=Platform.FIRE_TV,
                    package_name="com.espn.score_center",
                    activity_name="com.espn.mobile.android.ui.MainActivity",
                    url_scheme="espn",
                    asin="B00KQPQHPQ"
                ),
                Platform.ANDROID_TV: DeepLinkConfig(
                    app=StreamingApp.ESPN,
                    platform=Platform.ANDROID_TV,
                    package_name="com.espn.score_center",
                    url_scheme="espn"
                )
            },
            StreamingApp.PARAMOUNT_PLUS.value: {
                Platform.FIRE_TV: DeepLinkConfig(
                    app=StreamingApp.PARAMOUNT_PLUS,
                    platform=Platform.FIRE_TV,
                    package_name="com.cbs.ott",
                    activity_name="com.cbs.ott.MainActivity",
                    url_scheme="paramountplus",
                    asin="B08KQZXHPX"
                )
            },
            StreamingApp.PEACOCK.value: {
                Platform.FIRE_TV: DeepLinkConfig(
                    app=StreamingApp.PEACOCK,
                    platform=Platform.FIRE_TV,
                    package_name="com.peacocktv.peacockandroid",
                    activity_name="com.peacocktv.peacockandroid.MainActivity",
                    url_scheme="peacocktv",
                    asin="B087MHQZX1"
                )
            },
            StreamingApp.NETFLIX.value: {
                Platform.FIRE_TV: DeepLinkConfig(
                    app=StreamingApp.NETFLIX,
                    platform=Platform.FIRE_TV,
                    package_name="com.netflix.ninja",
                    activity_name="com.netflix.ninja.MainActivity",
                    url_scheme="nflx",
                    asin="B00DBYBNZA"
                )
            }
        }
    
    def build_deep_link(self, 
                       app: StreamingApp, 
                       platform: Platform,
                       content_id: Optional[str] = None,
                       content_type: str = "video",
                       extra_params: Optional[Dict[str, Any]] = None) -> Optional[str]:
        """
        Build a deep link for the specified app and platform
        
        Args:
            app: Target streaming app
            platform: Target platform (Fire TV, Android TV, etc.)
            content_id: Specific content identifier
            content_type: Type of content (video, live, series, etc.)
            extra_params: Additional parameters for the deep link
            
        Returns:
            Deep link URL string or None if configuration not found
        """
        try:
            config = self.app_configs.get(app.value, {}).get(platform)
            if not config:
                logger.warning(f"No configuration found for {app.value} on {platform.value}")
                return None
            
            if platform == Platform.FIRE_TV:
                return self._build_fire_tv_deep_link(config, content_id, content_type, extra_params)
            elif platform == Platform.ANDROID_TV:
                return self._build_android_tv_deep_link(config, content_id, content_type, extra_params)
            elif platform == Platform.ROKU:
                return self._build_roku_deep_link(config, content_id, content_type, extra_params)
            else:
                logger.warning(f"Platform {platform.value} not supported yet")
                return None
                
        except Exception as e:
            logger.error(f"Error building deep link for {app.value} on {platform.value}: {e}")
            return None
    
    def _build_fire_tv_deep_link(self, 
                                config: DeepLinkConfig,
                                content_id: Optional[str] = None,
                                content_type: str = "video",
                                extra_params: Optional[Dict[str, Any]] = None) -> str:
        """Build Fire TV specific deep link"""
        
        # Build the inner intent for the specific app
        inner_intent_parts = []
        
        # Add action
        inner_intent_parts.append("action=android.intent.action.VIEW")
        
        # Add component if available
        if config.activity_name:
            inner_intent_parts.append(f"component={config.package_name}/{config.activity_name}")
        
        # Add content-specific data
        if content_id:
            if config.app == StreamingApp.PRIME_VIDEO:
                # Prime Video specific content URL
                content_url = f"https://app.primevideo.com/detail?gti={content_id}"
                inner_intent_parts.append(f"S.contentUrl={urllib.parse.quote(content_url)}")
            elif config.app == StreamingApp.ESPN:
                # ESPN specific content URL
                inner_intent_parts.append(f"S.contentId={content_id}")
                inner_intent_parts.append(f"S.contentType={content_type}")
            else:
                # Generic content ID
                inner_intent_parts.append(f"S.contentId={content_id}")
        
        # Add extra parameters
        if extra_params:
            for key, value in extra_params.items():
                inner_intent_parts.append(f"S.{key}={urllib.parse.quote(str(value))}")
        
        # Build the encoded inner intent
        inner_intent = ";".join(inner_intent_parts) + ";end"
        
        # Build the Fire TV deep link using Amazon's scheme
        if config.asin:
            deep_link = f"amzns://apps/android?asin={config.asin}#Intent;{inner_intent}"
        else:
            # Fallback to direct intent
            deep_link = f"intent://{config.package_name}#{inner_intent}"
        
        logger.debug(f"Generated Fire TV deep link: {deep_link}")
        return deep_link
    
    def _build_android_tv_deep_link(self, 
                                   config: DeepLinkConfig,
                                   content_id: Optional[str] = None,
                                   content_type: str = "video",
                                   extra_params: Optional[Dict[str, Any]] = None) -> str:
        """Build Android TV specific deep link"""
        
        # Use URL scheme if available, otherwise use intent
        if config.url_scheme and content_id:
            if config.app == StreamingApp.PRIME_VIDEO:
                deep_link = f"{config.url_scheme}://video/{content_id}"
            elif config.app == StreamingApp.ESPN:
                deep_link = f"{config.url_scheme}://content/{content_type}/{content_id}"
            else:
                deep_link = f"{config.url_scheme}://content/{content_id}"
        else:
            # Build intent-based deep link
            intent_parts = [
                "intent:",
                f"package={config.package_name}",
                "action=android.intent.action.VIEW"
            ]
            
            if content_id:
                intent_parts.append(f"S.contentId={content_id}")
            
            if extra_params:
                for key, value in extra_params.items():
                    intent_parts.append(f"S.{key}={value}")
            
            deep_link = "#Intent;".join(intent_parts) + ";end"
        
        logger.debug(f"Generated Android TV deep link: {deep_link}")
        return deep_link
    
    def _build_roku_deep_link(self, 
                             config: DeepLinkConfig,
                             content_id: Optional[str] = None,
                             content_type: str = "video",
                             extra_params: Optional[Dict[str, Any]] = None) -> str:
        """Build Roku specific deep link"""
        
        # Roku uses a different format
        # This is a placeholder implementation
        logger.info("Roku deep link generation - placeholder implementation")
        return f"roku://launch/{config.package_name}?contentId={content_id or 'default'}"
    
    def build_sports_deep_link(self, 
                              app: StreamingApp,
                              platform: Platform,
                              sport: str,
                              league: str,
                              team1: str,
                              team2: str,
                              game_id: Optional[str] = None,
                              is_live: bool = False) -> Optional[str]:
        """
        Build a deep link specifically for sports content
        
        Args:
            app: Target streaming app
            platform: Target platform
            sport: Sport type (football, basketball, etc.)
            league: League name (NFL, NBA, etc.)
            team1: Home team
            team2: Away team
            game_id: Specific game identifier
            is_live: Whether the game is currently live
            
        Returns:
            Sports-specific deep link URL
        """
        extra_params = {
            'sport': sport.lower(),
            'league': league.upper(),
            'homeTeam': team1,
            'awayTeam': team2,
            'isLive': str(is_live).lower()
        }
        
        content_type = "live" if is_live else "upcoming"
        
        return self.build_deep_link(
            app=app,
            platform=platform,
            content_id=game_id,
            content_type=content_type,
            extra_params=extra_params
        )
    
    def validate_deep_link(self, deep_link: str) -> bool:
        """
        Validate if a deep link has the correct format
        
        Args:
            deep_link: Deep link URL to validate
            
        Returns:
            True if valid, False otherwise
        """
        try:
            # Basic validation checks
            if not deep_link:
                return False
            
            # Check for common deep link schemes
            valid_schemes = ['amzns://', 'intent://', 'aiv://', 'espn://', 'nflx://', 'paramountplus://', 'peacocktv://']
            
            if not any(deep_link.startswith(scheme) for scheme in valid_schemes):
                return False
            
            # Additional validation can be added here
            return True
            
        except Exception as e:
            logger.error(f"Error validating deep link: {e}")
            return False
    
    def get_supported_apps(self, platform: Platform) -> List[StreamingApp]:
        """Get list of supported apps for a platform"""
        supported_apps = []
        
        for app_name, platform_configs in self.app_configs.items():
            if platform in platform_configs:
                app_enum = StreamingApp(app_name)
                supported_apps.append(app_enum)
        
        return supported_apps

