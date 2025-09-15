
"""
Git Conflict Resolution System

Specialized system for detecting, analyzing, and automatically resolving
git merge conflicts during installation and deployment processes.
"""

import os
import re
import git
import logging
import subprocess
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
from pathlib import Path
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)

class ConflictType(Enum):
    """Types of git conflicts"""
    CONTENT_CONFLICT = "content_conflict"
    FILE_DELETED = "file_deleted"
    FILE_ADDED = "file_added"
    FILE_RENAMED = "file_renamed"
    BINARY_CONFLICT = "binary_conflict"
    SUBMODULE_CONFLICT = "submodule_conflict"

class ResolutionStrategy(Enum):
    """Conflict resolution strategies"""
    PREFER_OURS = "prefer_ours"
    PREFER_THEIRS = "prefer_theirs"
    MERGE_BOTH = "merge_both"
    REGENERATE = "regenerate"
    MANUAL_REVIEW = "manual_review"

@dataclass
class ConflictFile:
    """Represents a file with merge conflicts"""
    file_path: str
    conflict_type: ConflictType
    our_content: Optional[str] = None
    their_content: Optional[str] = None
    base_content: Optional[str] = None
    conflict_markers: List[Tuple[int, int]] = None  # (start_line, end_line) pairs
    resolution_strategy: Optional[ResolutionStrategy] = None
    auto_resolvable: bool = False

@dataclass
class ConflictResolution:
    """Result of conflict resolution attempt"""
    file_path: str
    success: bool
    strategy_used: ResolutionStrategy
    resolved_content: Optional[str] = None
    error_message: Optional[str] = None
    backup_created: bool = False

class GitConflictResolver:
    """
    Intelligent git conflict resolution system
    """
    
    def __init__(self, repo_path: str = ".", config: Dict[str, Any] = None):
        self.repo_path = Path(repo_path)
        self.config = config or {}
        
        try:
            self.repo = git.Repo(self.repo_path)
        except git.InvalidGitRepositoryError:
            logger.error(f"Invalid git repository: {self.repo_path}")
            self.repo = None
        
        # Configuration
        self.auto_resolve_enabled = self.config.get("auto_resolve_enabled", True)
        self.backup_before_resolve = self.config.get("backup_before_resolve", True)
        self.safe_file_patterns = self.config.get("safe_file_patterns", [
            "*.md", "*.txt", "*.json", "*.yaml", "*.yml", "*.ini", "*.cfg"
        ])
        self.dangerous_file_patterns = self.config.get("dangerous_file_patterns", [
            "*.py", "*.js", "*.ts", "*.java", "*.cpp", "*.c", "*.h"
        ])
        
        logger.info(f"GitConflictResolver initialized for repository: {self.repo_path}")
    
    def detect_conflicts(self) -> List[ConflictFile]:
        """Detect all merge conflicts in the repository"""
        if not self.repo:
            return []
        
        conflicts = []
        
        try:
            # Get list of conflicted files
            conflicted_files = self._get_conflicted_files()
            
            for file_path in conflicted_files:
                conflict_file = self._analyze_conflict_file(file_path)
                if conflict_file:
                    conflicts.append(conflict_file)
            
            logger.info(f"Detected {len(conflicts)} conflicted files")
            return conflicts
        
        except Exception as e:
            logger.error(f"Error detecting conflicts: {e}")
            return []
    
    def _get_conflicted_files(self) -> List[str]:
        """Get list of files with merge conflicts"""
        try:
            # Use git diff to find conflicted files
            result = subprocess.run(
                ['git', 'diff', '--name-only', '--diff-filter=U'],
                cwd=self.repo_path,
                capture_output=True,
                text=True,
                check=True
            )
            
            files = [f.strip() for f in result.stdout.split('\n') if f.strip()]
            return files
        
        except subprocess.CalledProcessError as e:
            logger.error(f"Error getting conflicted files: {e}")
            return []
    
    def _analyze_conflict_file(self, file_path: str) -> Optional[ConflictFile]:
        """Analyze a specific conflicted file"""
        try:
            full_path = self.repo_path / file_path
            
            if not full_path.exists():
                return ConflictFile(
                    file_path=file_path,
                    conflict_type=ConflictType.FILE_DELETED,
                    auto_resolvable=True,
                    resolution_strategy=ResolutionStrategy.PREFER_THEIRS
                )
            
            # Check if file is binary
            if self._is_binary_file(full_path):
                return ConflictFile(
                    file_path=file_path,
                    conflict_type=ConflictType.BINARY_CONFLICT,
                    auto_resolvable=False,
                    resolution_strategy=ResolutionStrategy.MANUAL_REVIEW
                )
            
            # Read file content
            with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            
            # Find conflict markers
            conflict_markers = self._find_conflict_markers(content)
            
            if not conflict_markers:
                # No conflict markers found, might be a different type of conflict
                return ConflictFile(
                    file_path=file_path,
                    conflict_type=ConflictType.CONTENT_CONFLICT,
                    auto_resolvable=False,
                    resolution_strategy=ResolutionStrategy.MANUAL_REVIEW
                )
            
            # Extract our and their content
            our_content, their_content, base_content = self._extract_conflict_content(content, conflict_markers)
            
            # Determine resolution strategy
            strategy = self._determine_resolution_strategy(file_path, our_content, their_content)
            
            return ConflictFile(
                file_path=file_path,
                conflict_type=ConflictType.CONTENT_CONFLICT,
                our_content=our_content,
                their_content=their_content,
                base_content=base_content,
                conflict_markers=conflict_markers,
                resolution_strategy=strategy,
                auto_resolvable=strategy != ResolutionStrategy.MANUAL_REVIEW
            )
        
        except Exception as e:
            logger.error(f"Error analyzing conflict file {file_path}: {e}")
            return None
    
    def _is_binary_file(self, file_path: Path) -> bool:
        """Check if file is binary"""
        try:
            with open(file_path, 'rb') as f:
                chunk = f.read(1024)
                return b'\0' in chunk
        except:
            return True
    
    def _find_conflict_markers(self, content: str) -> List[Tuple[int, int]]:
        """Find conflict marker positions in file content"""
        lines = content.split('\n')
        markers = []
        start_marker = None
        
        for i, line in enumerate(lines):
            if line.startswith('<<<<<<<'):
                start_marker = i
            elif line.startswith('>>>>>>>') and start_marker is not None:
                markers.append((start_marker, i))
                start_marker = None
        
        return markers
    
    def _extract_conflict_content(self, content: str, markers: List[Tuple[int, int]]) -> Tuple[str, str, str]:
        """Extract our, their, and base content from conflict markers"""
        lines = content.split('\n')
        our_lines = []
        their_lines = []
        base_lines = []
        
        for start, end in markers:
            # Find separator markers
            separator = None
            base_separator = None
            
            for i in range(start + 1, end):
                if lines[i].startswith('======='):
                    separator = i
                elif lines[i].startswith('|||||||'):
                    base_separator = i
            
            if separator is None:
                continue
            
            # Extract our content (between start and separator)
            our_section = lines[start + 1:separator]
            our_lines.extend(our_section)
            
            # Extract their content (between separator and end)
            their_section = lines[separator + 1:end]
            their_lines.extend(their_section)
            
            # Extract base content if available
            if base_separator is not None:
                base_section = lines[base_separator + 1:separator]
                base_lines.extend(base_section)
        
        return '\n'.join(our_lines), '\n'.join(their_lines), '\n'.join(base_lines)
    
    def _determine_resolution_strategy(self, file_path: str, our_content: str, their_content: str) -> ResolutionStrategy:
        """Determine the best resolution strategy for a conflict"""
        file_name = os.path.basename(file_path)
        file_ext = os.path.splitext(file_path)[1]
        
        # Configuration files - prefer their changes (remote)
        if any(pattern.replace('*', '') in file_path for pattern in [
            'config', 'settings', '.env', 'package.json', 'requirements.txt'
        ]):
            return ResolutionStrategy.PREFER_THEIRS
        
        # Documentation files - can usually be merged safely
        if file_ext in ['.md', '.txt', '.rst']:
            if self._can_merge_safely(our_content, their_content):
                return ResolutionStrategy.MERGE_BOTH
            else:
                return ResolutionStrategy.PREFER_THEIRS
        
        # Generated files - regenerate instead of merging
        if any(pattern in file_path for pattern in [
            'package-lock.json', 'yarn.lock', 'Pipfile.lock', '__pycache__',
            'node_modules', '.pyc', 'dist/', 'build/'
        ]):
            return ResolutionStrategy.REGENERATE
        
        # Safe file patterns - can attempt automatic resolution
        if any(self._match_pattern(file_path, pattern) for pattern in self.safe_file_patterns):
            if len(our_content.strip()) == 0:
                return ResolutionStrategy.PREFER_THEIRS
            elif len(their_content.strip()) == 0:
                return ResolutionStrategy.PREFER_OURS
            else:
                return ResolutionStrategy.PREFER_THEIRS  # Default to remote changes
        
        # Dangerous file patterns - require manual review
        if any(self._match_pattern(file_path, pattern) for pattern in self.dangerous_file_patterns):
            return ResolutionStrategy.MANUAL_REVIEW
        
        # Default strategy
        return ResolutionStrategy.PREFER_THEIRS
    
    def _match_pattern(self, file_path: str, pattern: str) -> bool:
        """Check if file path matches a pattern"""
        import fnmatch
        return fnmatch.fnmatch(file_path, pattern)
    
    def _can_merge_safely(self, our_content: str, their_content: str) -> bool:
        """Check if two content blocks can be merged safely"""
        # Simple heuristic: if contents don't overlap significantly, they can be merged
        our_lines = set(our_content.split('\n'))
        their_lines = set(their_content.split('\n'))
        
        # If there's minimal overlap, it's probably safe to merge
        overlap = len(our_lines.intersection(their_lines))
        total_unique = len(our_lines.union(their_lines))
        
        overlap_ratio = overlap / max(total_unique, 1)
        return overlap_ratio < 0.3  # Less than 30% overlap
    
    async def resolve_conflicts(self, conflicts: List[ConflictFile] = None) -> List[ConflictResolution]:
        """Resolve all detected conflicts"""
        if conflicts is None:
            conflicts = self.detect_conflicts()
        
        if not conflicts:
            logger.info("No conflicts to resolve")
            return []
        
        resolutions = []
        
        for conflict in conflicts:
            if conflict.auto_resolvable and self.auto_resolve_enabled:
                resolution = await self._resolve_single_conflict(conflict)
                resolutions.append(resolution)
            else:
                # Create manual review resolution
                resolution = ConflictResolution(
                    file_path=conflict.file_path,
                    success=False,
                    strategy_used=ResolutionStrategy.MANUAL_REVIEW,
                    error_message="Requires manual review"
                )
                resolutions.append(resolution)
        
        # If all conflicts were resolved, complete the merge
        successful_resolutions = [r for r in resolutions if r.success]
        if len(successful_resolutions) == len(conflicts):
            await self._complete_merge()
        
        return resolutions
    
    async def _resolve_single_conflict(self, conflict: ConflictFile) -> ConflictResolution:
        """Resolve a single conflict file"""
        try:
            # Create backup if enabled
            backup_created = False
            if self.backup_before_resolve:
                backup_created = self._create_backup(conflict.file_path)
            
            resolved_content = None
            
            if conflict.resolution_strategy == ResolutionStrategy.PREFER_OURS:
                resolved_content = conflict.our_content or ""
            
            elif conflict.resolution_strategy == ResolutionStrategy.PREFER_THEIRS:
                resolved_content = conflict.their_content or ""
            
            elif conflict.resolution_strategy == ResolutionStrategy.MERGE_BOTH:
                resolved_content = self._merge_content(conflict.our_content, conflict.their_content)
            
            elif conflict.resolution_strategy == ResolutionStrategy.REGENERATE:
                resolved_content = await self._regenerate_file_content(conflict.file_path)
            
            else:
                return ConflictResolution(
                    file_path=conflict.file_path,
                    success=False,
                    strategy_used=conflict.resolution_strategy,
                    error_message="Strategy not implemented",
                    backup_created=backup_created
                )
            
            # Write resolved content
            if resolved_content is not None:
                full_path = self.repo_path / conflict.file_path
                with open(full_path, 'w', encoding='utf-8') as f:
                    f.write(resolved_content)
                
                # Stage the resolved file
                self.repo.index.add([conflict.file_path])
                
                logger.info(f"Resolved conflict in {conflict.file_path} using {conflict.resolution_strategy.value}")
                
                return ConflictResolution(
                    file_path=conflict.file_path,
                    success=True,
                    strategy_used=conflict.resolution_strategy,
                    resolved_content=resolved_content,
                    backup_created=backup_created
                )
            
            else:
                return ConflictResolution(
                    file_path=conflict.file_path,
                    success=False,
                    strategy_used=conflict.resolution_strategy,
                    error_message="Could not generate resolved content",
                    backup_created=backup_created
                )
        
        except Exception as e:
            logger.error(f"Error resolving conflict in {conflict.file_path}: {e}")
            return ConflictResolution(
                file_path=conflict.file_path,
                success=False,
                strategy_used=conflict.resolution_strategy,
                error_message=str(e),
                backup_created=backup_created
            )
    
    def _create_backup(self, file_path: str) -> bool:
        """Create backup of conflicted file"""
        try:
            full_path = self.repo_path / file_path
            backup_path = self.repo_path / f"{file_path}.conflict_backup_{int(datetime.now().timestamp())}"
            
            if full_path.exists():
                backup_path.parent.mkdir(parents=True, exist_ok=True)
                with open(full_path, 'r', encoding='utf-8', errors='ignore') as src:
                    with open(backup_path, 'w', encoding='utf-8') as dst:
                        dst.write(src.read())
                
                logger.info(f"Created backup: {backup_path}")
                return True
        
        except Exception as e:
            logger.error(f"Error creating backup for {file_path}: {e}")
        
        return False
    
    def _merge_content(self, our_content: str, their_content: str) -> str:
        """Merge two content blocks intelligently"""
        # Simple merge strategy: combine unique lines
        our_lines = our_content.split('\n') if our_content else []
        their_lines = their_content.split('\n') if their_content else []
        
        # Combine and deduplicate while preserving order
        merged_lines = []
        seen_lines = set()
        
        for line in our_lines + their_lines:
            if line not in seen_lines:
                merged_lines.append(line)
                seen_lines.add(line)
        
        return '\n'.join(merged_lines)
    
    async def _regenerate_file_content(self, file_path: str) -> Optional[str]:
        """Regenerate file content for generated files"""
        file_name = os.path.basename(file_path)
        
        try:
            # Handle package-lock.json
            if file_name == 'package-lock.json':
                result = subprocess.run(
                    ['npm', 'install'],
                    cwd=self.repo_path,
                    capture_output=True,
                    text=True
                )
                if result.returncode == 0:
                    with open(self.repo_path / file_path, 'r') as f:
                        return f.read()
            
            # Handle other generated files
            # This would be extended based on specific file types
            
        except Exception as e:
            logger.error(f"Error regenerating {file_path}: {e}")
        
        return None
    
    async def _complete_merge(self):
        """Complete the merge process"""
        try:
            # Check if there are any remaining conflicts
            remaining_conflicts = self._get_conflicted_files()
            
            if not remaining_conflicts:
                # Commit the merge
                self.repo.index.commit("Resolve merge conflicts automatically")
                logger.info("Merge completed successfully")
            else:
                logger.warning(f"Merge not completed - {len(remaining_conflicts)} conflicts remain")
        
        except Exception as e:
            logger.error(f"Error completing merge: {e}")
    
    def get_conflict_summary(self) -> Dict[str, Any]:
        """Get summary of current conflicts"""
        conflicts = self.detect_conflicts()
        
        auto_resolvable = len([c for c in conflicts if c.auto_resolvable])
        manual_review = len([c for c in conflicts if not c.auto_resolvable])
        
        conflict_types = {}
        for conflict in conflicts:
            conflict_type = conflict.conflict_type.value
            conflict_types[conflict_type] = conflict_types.get(conflict_type, 0) + 1
        
        return {
            "total_conflicts": len(conflicts),
            "auto_resolvable": auto_resolvable,
            "manual_review_required": manual_review,
            "conflict_types": conflict_types,
            "files": [
                {
                    "path": c.file_path,
                    "type": c.conflict_type.value,
                    "strategy": c.resolution_strategy.value if c.resolution_strategy else None,
                    "auto_resolvable": c.auto_resolvable
                }
                for c in conflicts
            ]
        }
    
    def create_conflict_resolution_branch(self, branch_name: str = None) -> str:
        """Create a new branch for conflict resolution"""
        if not branch_name:
            timestamp = int(datetime.now().timestamp())
            branch_name = f"conflict-resolution-{timestamp}"
        
        try:
            # Create new branch
            new_branch = self.repo.create_head(branch_name)
            new_branch.checkout()
            
            logger.info(f"Created conflict resolution branch: {branch_name}")
            return branch_name
        
        except Exception as e:
            logger.error(f"Error creating conflict resolution branch: {e}")
            raise
    
    def abort_merge(self):
        """Abort the current merge operation"""
        try:
            subprocess.run(
                ['git', 'merge', '--abort'],
                cwd=self.repo_path,
                check=True
            )
            logger.info("Merge aborted successfully")
        
        except subprocess.CalledProcessError as e:
            logger.error(f"Error aborting merge: {e}")
            raise
