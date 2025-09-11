
"""
TV Guide Integration Module
Provides TV guide data and channel information for sports bar automation
Supports multiple guide sources and channel mapping
"""
import requests
import json
import time
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any
from dataclasses import dataclass, asdict
from enum import Enum

class GuideSource(Enum):
    """TV Guide data sources"""
    TVMAZE = "tvmaze"
    TMDB = "tmdb"
    GRACENOTE = "gracenote"
    LOCAL_LISTINGS = "local"

@dataclass
class TVShow:
    """Represents a TV show/program"""
    title: str
    description: str = ""
    genre: str = ""
    rating: str = ""
    duration: int = 0  # minutes
    season: int = 0
    episode: int = 0
    is_live: bool = False
    is_sports: bool = False
    is_news: bool = False

@dataclass
class TVProgram:
    """Represents a scheduled TV program"""
    show: TVShow
    channel: str
    channel_name: str
    start_time: datetime
    end_time: datetime
    is_current: bool = False
    is_upcoming: bool = False

@dataclass
class TVChannel:
    """Represents a TV channel"""
    number: str
    name: str
    network: str = ""
    hd: bool = False
    category: str = ""  # sports, news, entertainment, etc.
    logo_url: str = ""

class TVGuideIntegration:
    """
    TV Guide integration for sports bar automation
    Provides program listings, sports detection, and channel information
    """

    def __init__(self, guide_source: GuideSource = GuideSource.TVMAZE, api_key: str = ""):
        """
        Initialize TV Guide integration

        Args:
            guide_source: Source for TV guide data
            api_key: API key if required by the source
        """
        self.guide_source = guide_source
        self.api_key = api_key
        
        # Setup logging
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger("TVGuide")

        # Cache for guide data
        self.channels_cache: Dict[str, TVChannel] = {}
        self.programs_cache: Dict[str, List[TVProgram]] = {}
        self.cache_expiry = datetime.now()
        self.cache_duration = timedelta(hours=1)

        # Load channel mappings
        self._load_channel_mappings()

    def _load_channel_mappings(self):
        """Load common channel mappings for sports bars"""
        self.sports_channels = {
            "ESPN": ["2", "206", "ESPN", "ESPN HD"],
            "ESPN2": ["209", "ESPN2", "ESPN2 HD"],
            "FOX Sports 1": ["219", "FS1", "FOX Sports 1 HD"],
            "FOX Sports 2": ["220", "FS2", "FOX Sports 2 HD"],
            "NFL Network": ["212", "NFLN", "NFL Network HD"],
            "NBA TV": ["216", "NBATV", "NBA TV HD"],
            "MLB Network": ["213", "MLBN", "MLB Network HD"],
            "NHL Network": ["215", "NHLN", "NHL Network HD"],
            "Golf Channel": ["218", "GOLF", "Golf Channel HD"],
            "Tennis Channel": ["217", "TENNIS", "Tennis Channel HD"],
            "CBS Sports": ["221", "CBSSN", "CBS Sports Network HD"],
            "NBC Sports": ["220", "NBCSN", "NBC Sports Network HD"]
        }

        self.news_channels = {
            "CNN": ["202", "CNN", "CNN HD"],
            "FOX News": ["205", "FOXNEWS", "FOX News HD"],
            "MSNBC": ["203", "MSNBC", "MSNBC HD"],
            "ESPN News": ["207", "ESPNNEWS", "ESPN News HD"]
        }

        # Create channel objects
        self.channels_cache = {}
        for name, identifiers in self.sports_channels.items():
            channel = TVChannel(
                number=identifiers[0],
                name=name,
                network=name,
                hd=True,
                category="sports"
            )
            for identifier in identifiers:
                self.channels_cache[identifier] = channel

        for name, identifiers in self.news_channels.items():
            channel = TVChannel(
                number=identifiers[0],
                name=name,
                network=name,
                hd=True,
                category="news"
            )
            for identifier in identifiers:
                self.channels_cache[identifier] = channel

    def get_current_programs(self, channels: List[str] = None) -> List[TVProgram]:
        """
        Get currently airing programs

        Args:
            channels: List of channel identifiers to check (None for all)

        Returns:
            List[TVProgram]: Currently airing programs
        """
        if self._cache_expired():
            self._refresh_guide_data()

        current_time = datetime.now()
        current_programs = []

        channels_to_check = channels or list(self.channels_cache.keys())

        for channel_id in channels_to_check:
            if channel_id in self.programs_cache:
                for program in self.programs_cache[channel_id]:
                    if program.start_time <= current_time <= program.end_time:
                        program.is_current = True
                        current_programs.append(program)

        return current_programs

    def get_upcoming_programs(self, hours_ahead: int = 4, channels: List[str] = None) -> List[TVProgram]:
        """
        Get upcoming programs

        Args:
            hours_ahead: How many hours ahead to look
            channels: List of channel identifiers to check

        Returns:
            List[TVProgram]: Upcoming programs
        """
        if self._cache_expired():
            self._refresh_guide_data()

        current_time = datetime.now()
        end_time = current_time + timedelta(hours=hours_ahead)
        upcoming_programs = []

        channels_to_check = channels or list(self.channels_cache.keys())

        for channel_id in channels_to_check:
            if channel_id in self.programs_cache:
                for program in self.programs_cache[channel_id]:
                    if current_time < program.start_time <= end_time:
                        program.is_upcoming = True
                        upcoming_programs.append(program)

        return sorted(upcoming_programs, key=lambda p: p.start_time)

    def get_sports_programs(self, hours_ahead: int = 8) -> List[TVProgram]:
        """
        Get current and upcoming sports programs

        Args:
            hours_ahead: How many hours ahead to look

        Returns:
            List[TVProgram]: Sports programs
        """
        sports_channels = [ch for ch in self.channels_cache.keys() 
                          if self.channels_cache[ch].category == "sports"]
        
        current_sports = self.get_current_programs(sports_channels)
        upcoming_sports = self.get_upcoming_programs(hours_ahead, sports_channels)

        # Filter for actual sports content
        sports_programs = []
        for program in current_sports + upcoming_sports:
            if (program.show.is_sports or 
                any(sport in program.show.title.lower() for sport in 
                    ['football', 'basketball', 'baseball', 'hockey', 'soccer', 'golf', 'tennis', 'game', 'vs', 'at'])):
                sports_programs.append(program)

        return sorted(sports_programs, key=lambda p: p.start_time)

    def find_program_by_title(self, title: str, hours_ahead: int = 24) -> List[TVProgram]:
        """
        Find programs by title

        Args:
            title: Program title to search for
            hours_ahead: How many hours ahead to search

        Returns:
            List[TVProgram]: Matching programs
        """
        if self._cache_expired():
            self._refresh_guide_data()

        current_time = datetime.now()
        end_time = current_time + timedelta(hours=hours_ahead)
        matching_programs = []

        for channel_programs in self.programs_cache.values():
            for program in channel_programs:
                if (current_time <= program.end_time <= end_time and
                    title.lower() in program.show.title.lower()):
                    matching_programs.append(program)

        return sorted(matching_programs, key=lambda p: p.start_time)

    def get_channel_info(self, channel_identifier: str) -> Optional[TVChannel]:
        """
        Get channel information

        Args:
            channel_identifier: Channel number, name, or identifier

        Returns:
            TVChannel: Channel information or None if not found
        """
        return self.channels_cache.get(channel_identifier)

    def get_sports_channels(self) -> List[TVChannel]:
        """Get all sports channels"""
        sports_channels = []
        seen_channels = set()
        
        for channel in self.channels_cache.values():
            if channel.category == "sports" and channel.name not in seen_channels:
                sports_channels.append(channel)
                seen_channels.add(channel.name)
        
        return sorted(sports_channels, key=lambda c: c.name)

    def _cache_expired(self) -> bool:
        """Check if cache has expired"""
        return datetime.now() > self.cache_expiry

    def _refresh_guide_data(self):
        """Refresh guide data from source"""
        self.logger.info(f"Refreshing guide data from {self.guide_source.value}")
        
        if self.guide_source == GuideSource.TVMAZE:
            self._fetch_tvmaze_data()
        elif self.guide_source == GuideSource.LOCAL_LISTINGS:
            self._generate_sample_data()
        else:
            self.logger.warning(f"Guide source {self.guide_source.value} not implemented")
            self._generate_sample_data()

        self.cache_expiry = datetime.now() + self.cache_duration

    def _fetch_tvmaze_data(self):
        """Fetch data from TVMaze API"""
        try:
            # TVMaze doesn't require API key for basic schedule data
            today = datetime.now().strftime("%Y-%m-%d")
            url = f"https://api.tvmaze.com/schedule?country=US&date={today}"
            
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            
            schedule_data = response.json()
            self._process_tvmaze_schedule(schedule_data)
            
        except Exception as e:
            self.logger.error(f"Failed to fetch TVMaze data: {e}")
            self._generate_sample_data()

    def _process_tvmaze_schedule(self, schedule_data: List[Dict]):
        """Process TVMaze schedule data"""
        self.programs_cache.clear()
        
        for item in schedule_data:
            try:
                show_data = item.get('show', {})
                
                # Create show object
                show = TVShow(
                    title=show_data.get('name', 'Unknown'),
                    description=show_data.get('summary', '').replace('<p>', '').replace('</p>', ''),
                    genre=', '.join(show_data.get('genres', [])),
                    rating=show_data.get('rating', {}).get('average', ''),
                    is_sports='Sports' in show_data.get('genres', [])
                )
                
                # Parse air time
                airtime = item.get('airtime', '00:00')
                airdate = item.get('airdate', datetime.now().strftime('%Y-%m-%d'))
                start_time = datetime.strptime(f"{airdate} {airtime}", "%Y-%m-%d %H:%M")
                
                # Estimate end time (TVMaze doesn't always provide runtime)
                runtime = show_data.get('runtime', 60)  # Default 60 minutes
                end_time = start_time + timedelta(minutes=runtime)
                
                # Get network info
                network = item.get('show', {}).get('network', {})
                channel_name = network.get('name', 'Unknown') if network else 'Unknown'
                
                # Create program
                program = TVProgram(
                    show=show,
                    channel=channel_name,
                    channel_name=channel_name,
                    start_time=start_time,
                    end_time=end_time
                )
                
                # Add to cache
                if channel_name not in self.programs_cache:
                    self.programs_cache[channel_name] = []
                self.programs_cache[channel_name].append(program)
                
            except Exception as e:
                self.logger.error(f"Error processing TVMaze item: {e}")
                continue

    def _generate_sample_data(self):
        """Generate sample guide data for testing"""
        self.logger.info("Generating sample guide data")
        
        current_time = datetime.now()
        self.programs_cache.clear()
        
        # Sample sports programs
        sports_programs = [
            ("NFL Sunday Night Football", "ESPN", 180, True),
            ("NBA GameTime", "ESPN2", 60, True),
            ("MLB Tonight", "MLB Network", 60, True),
            ("SportsCenter", "ESPN", 60, False),
            ("College Football", "FOX Sports 1", 180, True),
            ("Premier League Soccer", "NBC Sports", 120, True),
            ("Golf Central", "Golf Channel", 30, False),
            ("Tennis Masters", "Tennis Channel", 120, True)
        ]
        
        for i, (title, channel, duration, is_live) in enumerate(sports_programs):
            start_time = current_time + timedelta(hours=i * 2)
            end_time = start_time + timedelta(minutes=duration)
            
            show = TVShow(
                title=title,
                description=f"Live sports coverage: {title}",
                genre="Sports",
                duration=duration,
                is_live=is_live,
                is_sports=True
            )
            
            program = TVProgram(
                show=show,
                channel=channel,
                channel_name=channel,
                start_time=start_time,
                end_time=end_time
            )
            
            if channel not in self.programs_cache:
                self.programs_cache[channel] = []
            self.programs_cache[channel].append(program)

    def get_sports_bar_recommendations(self) -> Dict[str, Any]:
        """
        Get TV programming recommendations for sports bars

        Returns:
            Dict: Recommendations with current and upcoming sports
        """
        current_sports = self.get_sports_programs(hours_ahead=2)
        upcoming_sports = self.get_sports_programs(hours_ahead=8)
        
        # Categorize by importance
        priority_sports = []
        regular_sports = []
        
        for program in current_sports + upcoming_sports:
            title_lower = program.show.title.lower()
            if any(keyword in title_lower for keyword in 
                   ['nfl', 'nba', 'mlb', 'nhl', 'championship', 'playoff', 'final']):
                priority_sports.append(program)
            else:
                regular_sports.append(program)
        
        return {
            "priority_sports": priority_sports[:5],  # Top 5 priority
            "regular_sports": regular_sports[:10],   # Top 10 regular
            "sports_channels": self.get_sports_channels(),
            "last_updated": datetime.now().isoformat()
        }

    def export_guide_data(self, filename: str = "tv_guide_export.json"):
        """Export current guide data to JSON file"""
        export_data = {
            "channels": {k: asdict(v) for k, v in self.channels_cache.items()},
            "programs": {},
            "exported_at": datetime.now().isoformat()
        }
        
        # Convert programs to serializable format
        for channel, programs in self.programs_cache.items():
            export_data["programs"][channel] = []
            for program in programs:
                program_dict = asdict(program)
                # Convert datetime objects to strings
                program_dict["start_time"] = program.start_time.isoformat()
                program_dict["end_time"] = program.end_time.isoformat()
                export_data["programs"][channel].append(program_dict)
        
        with open(filename, 'w') as f:
            json.dump(export_data, f, indent=2)
        
        self.logger.info(f"Guide data exported to {filename}")

# Example usage
def example_usage():
    """Example of how to use the TV Guide integration"""
    
    # Initialize guide
    guide = TVGuideIntegration(GuideSource.LOCAL_LISTINGS)
    
    # Get current sports programs
    current_sports = guide.get_sports_programs(hours_ahead=4)
    print(f"Current/Upcoming Sports ({len(current_sports)}):")
    for program in current_sports[:5]:
        print(f"  {program.channel}: {program.show.title} ({program.start_time.strftime('%H:%M')})")
    
    # Get sports bar recommendations
    recommendations = guide.get_sports_bar_recommendations()
    print(f"\nPriority Sports ({len(recommendations['priority_sports'])}):")
    for program in recommendations['priority_sports']:
        print(f"  {program.channel}: {program.show.title}")
    
    # Find specific program
    football_games = guide.find_program_by_title("football", hours_ahead=12)
    print(f"\nFootball Games ({len(football_games)}):")
    for game in football_games[:3]:
        print(f"  {game.channel}: {game.show.title} ({game.start_time.strftime('%m/%d %H:%M')})")
    
    # Export data
    guide.export_guide_data("sports_bar_guide.json")

if __name__ == "__main__":
    example_usage()
