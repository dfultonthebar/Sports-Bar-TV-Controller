
#!/usr/bin/env python3
"""
Sports Content Dashboard - Web interface for sports content discovery
Provides user-friendly interface for employees to access specific games
"""

import asyncio
import logging
from datetime import datetime
from flask import Blueprint, render_template, jsonify, request
from typing import Dict, List, Any

from services.content_discovery_manager import ContentDiscoveryManager

logger = logging.getLogger(__name__)

class SportsContentDashboard:
    """
    Dashboard for sports content discovery and deep linking
    """
    
    def __init__(self, content_manager: ContentDiscoveryManager):
        self.content_manager = content_manager
        self.blueprint = Blueprint('sports_content', __name__, url_prefix='/sports')
        self._register_routes()
        logger.info("Sports Content Dashboard initialized")
    
    def _register_routes(self):
        """Register Flask routes for the sports dashboard"""
        
        @self.blueprint.route('/')
        def sports_dashboard():
            """Main sports content dashboard page"""
            return render_template('sports_dashboard.html')
        
        @self.blueprint.route('/api/live')
        async def get_live_content():
            """API endpoint for live sports content"""
            try:
                max_results = request.args.get('limit', 10, type=int)
                preferred_sports = request.args.getlist('sports')
                
                recommendations = await self.content_manager.get_live_content_recommendations(
                    max_results=max_results,
                    preferred_sports=preferred_sports if preferred_sports else None
                )
                
                return jsonify({
                    'success': True,
                    'data': [self._recommendation_to_dict(rec) for rec in recommendations],
                    'count': len(recommendations)
                })
                
            except Exception as e:
                logger.error(f"Error fetching live content: {e}")
                return jsonify({
                    'success': False,
                    'error': str(e)
                }), 500
        
        @self.blueprint.route('/api/upcoming')
        async def get_upcoming_content():
            """API endpoint for upcoming sports content"""
            try:
                hours_ahead = request.args.get('hours', 24, type=int)
                max_results = request.args.get('limit', 20, type=int)
                preferred_sports = request.args.getlist('sports')
                
                recommendations = await self.content_manager.get_upcoming_content_recommendations(
                    hours_ahead=hours_ahead,
                    max_results=max_results,
                    preferred_sports=preferred_sports if preferred_sports else None
                )
                
                return jsonify({
                    'success': True,
                    'data': [self._recommendation_to_dict(rec) for rec in recommendations],
                    'count': len(recommendations)
                })
                
            except Exception as e:
                logger.error(f"Error fetching upcoming content: {e}")
                return jsonify({
                    'success': False,
                    'error': str(e)
                }), 500
        
        @self.blueprint.route('/api/search')
        async def search_content():
            """API endpoint for searching sports content"""
            try:
                query = request.args.get('q', '').strip()
                if not query:
                    return jsonify({
                        'success': False,
                        'error': 'Search query is required'
                    }), 400
                
                max_results = request.args.get('limit', 15, type=int)
                
                recommendations = await self.content_manager.search_content(
                    query=query,
                    max_results=max_results
                )
                
                return jsonify({
                    'success': True,
                    'data': [self._recommendation_to_dict(rec) for rec in recommendations],
                    'count': len(recommendations),
                    'query': query
                })
                
            except Exception as e:
                logger.error(f"Error searching content: {e}")
                return jsonify({
                    'success': False,
                    'error': str(e)
                }), 500
        
        @self.blueprint.route('/api/featured/<category>')
        async def get_featured_content(category):
            """API endpoint for featured sports content by category"""
            try:
                max_results = request.args.get('limit', 8, type=int)
                
                recommendations = await self.content_manager.get_featured_content(
                    category=category,
                    max_results=max_results
                )
                
                return jsonify({
                    'success': True,
                    'data': [self._recommendation_to_dict(rec) for rec in recommendations],
                    'count': len(recommendations),
                    'category': category
                })
                
            except Exception as e:
                logger.error(f"Error fetching featured content: {e}")
                return jsonify({
                    'success': False,
                    'error': str(e)
                }), 500
        
        @self.blueprint.route('/api/launch')
        def launch_content():
            """API endpoint to launch content via deep link"""
            try:
                deep_link = request.json.get('deep_link') if request.is_json else request.form.get('deep_link')
                
                if not deep_link:
                    return jsonify({
                        'success': False,
                        'error': 'Deep link is required'
                    }), 400
                
                # In a real implementation, this would trigger the Fire TV to launch the content
                # For now, we'll just validate the deep link and return success
                
                # Validate deep link format
                if not self.content_manager.deep_link_builder.validate_deep_link(deep_link):
                    return jsonify({
                        'success': False,
                        'error': 'Invalid deep link format'
                    }), 400
                
                # Log the launch attempt
                logger.info(f"Content launch requested: {deep_link}")
                
                # Here you would integrate with the Fire TV controller
                # For example: self.fire_tv_controller.launch_deep_link(deep_link)
                
                return jsonify({
                    'success': True,
                    'message': 'Content launch initiated',
                    'deep_link': deep_link
                })
                
            except Exception as e:
                logger.error(f"Error launching content: {e}")
                return jsonify({
                    'success': False,
                    'error': str(e)
                }), 500
        
        @self.blueprint.route('/api/stats')
        def get_dashboard_stats():
            """API endpoint for dashboard statistics"""
            try:
                # This would typically fetch real statistics
                # For now, return mock data
                stats = {
                    'total_providers': 5,
                    'supported_sports': ['Football', 'Basketball', 'Baseball', 'Hockey', 'Soccer'],
                    'last_updated': datetime.now().isoformat(),
                    'cache_status': 'active'
                }
                
                return jsonify({
                    'success': True,
                    'data': stats
                })
                
            except Exception as e:
                logger.error(f"Error fetching dashboard stats: {e}")
                return jsonify({
                    'success': False,
                    'error': str(e)
                }), 500
    
    def _recommendation_to_dict(self, recommendation) -> Dict[str, Any]:
        """Convert recommendation object to dictionary for JSON response"""
        return {
            'id': recommendation.event.id,
            'title': recommendation.event.title,
            'description': recommendation.event.description,
            'sport': recommendation.event.sport,
            'league': recommendation.event.league,
            'home_team': recommendation.event.home_team,
            'away_team': recommendation.event.away_team,
            'start_time': recommendation.event.start_time.isoformat(),
            'end_time': recommendation.event.end_time.isoformat(),
            'provider': recommendation.event.provider.value,
            'is_live': recommendation.event.is_live,
            'thumbnail_url': recommendation.event.thumbnail_url,
            'content_rating': recommendation.event.content_rating,
            'deep_link': recommendation.deep_link,
            'priority': recommendation.priority,
            'reason': recommendation.reason
        }
    
    def get_blueprint(self):
        """Get the Flask blueprint for registration"""
        return self.blueprint

