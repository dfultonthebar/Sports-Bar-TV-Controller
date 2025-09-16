
"""
GitHub Integration for Automated File Corrections and Branch Merging
Provides automated GitHub operations for the Sports Bar TV Controller
"""

import asyncio
import json
import logging
import os
import subprocess
import tempfile
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from pathlib import Path
import yaml
import time
import re

@dataclass
class GitHubRepository:
    """Represents a GitHub repository configuration"""
    owner: str
    name: str
    default_branch: str = "main"
    clone_url: str = ""
    access_token: str = ""
    
@dataclass
class PullRequest:
    """Represents a pull request"""
    number: int
    title: str
    head_branch: str
    base_branch: str
    state: str
    mergeable: bool = False
    conflicts: List[str] = None
    
    def __post_init__(self):
        if self.conflicts is None:
            self.conflicts = []

@dataclass
class FileCorrection:
    """Represents a file correction operation"""
    file_path: str
    correction_type: str  # 'syntax', 'style', 'logic', 'security'
    description: str
    original_content: str = ""
    corrected_content: str = ""
    confidence: float = 0.0

class GitHubAPIClient:
    """GitHub API client for repository operations"""
    
    def __init__(self, access_token: str):
        self.access_token = access_token
        self.logger = logging.getLogger(__name__)
        self.base_url = "https://api.github.com"
        
    async def get_repository_info(self, owner: str, repo: str) -> Optional[Dict[str, Any]]:
        """Get repository information"""
        try:
            # This would typically use the GitHub API
            # For now, we'll simulate with local git operations
            return {
                "owner": owner,
                "name": repo,
                "default_branch": "main",
                "clone_url": f"https://github.com/{owner}/{repo}.git"
            }
        except Exception as e:
            self.logger.error(f"Failed to get repository info: {e}")
            return None
    
    async def list_branches(self, owner: str, repo: str) -> List[str]:
        """List repository branches"""
        try:
            # Use git command to list branches
            result = subprocess.run(
                ["git", "branch", "-r"],
                capture_output=True,
                text=True,
                cwd=f"/home/ubuntu/github_repos/{repo}" if Path(f"/home/ubuntu/github_repos/{repo}").exists() else None
            )
            
            if result.returncode == 0:
                branches = []
                for line in result.stdout.split('\n'):
                    line = line.strip()
                    if line and not line.startswith('origin/HEAD'):
                        branch = line.replace('origin/', '')
                        branches.append(branch)
                return branches
            
            return []
            
        except Exception as e:
            self.logger.error(f"Failed to list branches: {e}")
            return []
    
    async def get_pull_requests(self, owner: str, repo: str, state: str = "open") -> List[PullRequest]:
        """Get pull requests for repository"""
        try:
            # This would typically use GitHub API
            # For now, return empty list as placeholder
            return []
        except Exception as e:
            self.logger.error(f"Failed to get pull requests: {e}")
            return []
    
    async def create_pull_request(self, owner: str, repo: str, title: str, 
                                head_branch: str, base_branch: str, body: str = "") -> Optional[PullRequest]:
        """Create a pull request"""
        try:
            # This would typically use GitHub API
            # For now, we'll simulate PR creation
            pr = PullRequest(
                number=int(time.time()) % 10000,  # Simulate PR number
                title=title,
                head_branch=head_branch,
                base_branch=base_branch,
                state="open",
                mergeable=True
            )
            
            self.logger.info(f"Created PR: {title} ({head_branch} -> {base_branch})")
            return pr
            
        except Exception as e:
            self.logger.error(f"Failed to create pull request: {e}")
            return None

class FileAnalyzer:
    """Analyzes files for potential corrections"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
    async def analyze_python_file(self, file_path: Path) -> List[FileCorrection]:
        """Analyze Python file for corrections"""
        corrections = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Check for common Python issues
            corrections.extend(await self._check_syntax_issues(file_path, content))
            corrections.extend(await self._check_style_issues(file_path, content))
            corrections.extend(await self._check_security_issues(file_path, content))
            
        except Exception as e:
            self.logger.error(f"Failed to analyze {file_path}: {e}")
            
        return corrections
    
    async def _check_syntax_issues(self, file_path: Path, content: str) -> List[FileCorrection]:
        """Check for syntax issues"""
        corrections = []
        
        try:
            # Try to compile the Python code
            compile(content, str(file_path), 'exec')
        except SyntaxError as e:
            correction = FileCorrection(
                file_path=str(file_path),
                correction_type="syntax",
                description=f"Syntax error at line {e.lineno}: {e.msg}",
                original_content=content,
                confidence=0.9
            )
            corrections.append(correction)
        except Exception as e:
            self.logger.debug(f"Compilation check failed for {file_path}: {e}")
            
        return corrections
    
    async def _check_style_issues(self, file_path: Path, content: str) -> List[FileCorrection]:
        """Check for style issues"""
        corrections = []
        lines = content.split('\n')
        
        for i, line in enumerate(lines, 1):
            # Check for long lines
            if len(line) > 120:
                correction = FileCorrection(
                    file_path=str(file_path),
                    correction_type="style",
                    description=f"Line {i} exceeds 120 characters ({len(line)} chars)",
                    confidence=0.7
                )
                corrections.append(correction)
            
            # Check for trailing whitespace
            if line.endswith(' ') or line.endswith('\t'):
                correction = FileCorrection(
                    file_path=str(file_path),
                    correction_type="style",
                    description=f"Line {i} has trailing whitespace",
                    confidence=0.8
                )
                corrections.append(correction)
        
        return corrections
    
    async def _check_security_issues(self, file_path: Path, content: str) -> List[FileCorrection]:
        """Check for security issues"""
        corrections = []
        
        # Check for hardcoded secrets
        secret_patterns = [
            (r'password\s*=\s*["\'][^"\']+["\']', "Hardcoded password detected"),
            (r'api_key\s*=\s*["\'][^"\']+["\']', "Hardcoded API key detected"),
            (r'secret\s*=\s*["\'][^"\']+["\']', "Hardcoded secret detected"),
        ]
        
        for pattern, description in secret_patterns:
            if re.search(pattern, content, re.IGNORECASE):
                correction = FileCorrection(
                    file_path=str(file_path),
                    correction_type="security",
                    description=description,
                    confidence=0.8
                )
                corrections.append(correction)
        
        return corrections
    
    async def analyze_yaml_file(self, file_path: Path) -> List[FileCorrection]:
        """Analyze YAML file for corrections"""
        corrections = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Try to parse YAML
            yaml.safe_load(content)
            
        except yaml.YAMLError as e:
            correction = FileCorrection(
                file_path=str(file_path),
                correction_type="syntax",
                description=f"YAML syntax error: {e}",
                original_content=content,
                confidence=0.9
            )
            corrections.append(correction)
        except Exception as e:
            self.logger.error(f"Failed to analyze YAML file {file_path}: {e}")
            
        return corrections
    
    async def analyze_json_file(self, file_path: Path) -> List[FileCorrection]:
        """Analyze JSON file for corrections"""
        corrections = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Try to parse JSON
            json.loads(content)
            
        except json.JSONDecodeError as e:
            correction = FileCorrection(
                file_path=str(file_path),
                correction_type="syntax",
                description=f"JSON syntax error: {e}",
                original_content=content,
                confidence=0.9
            )
            corrections.append(correction)
        except Exception as e:
            self.logger.error(f"Failed to analyze JSON file {file_path}: {e}")
            
        return corrections

class AutoCorrector:
    """Automatically corrects common file issues"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
    async def apply_corrections(self, corrections: List[FileCorrection]) -> Dict[str, Any]:
        """Apply corrections to files"""
        results = {
            "applied": [],
            "failed": [],
            "skipped": []
        }
        
        for correction in corrections:
            try:
                if correction.confidence < 0.7:
                    results["skipped"].append({
                        "file": correction.file_path,
                        "reason": "Low confidence",
                        "confidence": correction.confidence
                    })
                    continue
                
                success = await self._apply_single_correction(correction)
                
                if success:
                    results["applied"].append({
                        "file": correction.file_path,
                        "type": correction.correction_type,
                        "description": correction.description
                    })
                else:
                    results["failed"].append({
                        "file": correction.file_path,
                        "reason": "Failed to apply correction"
                    })
                    
            except Exception as e:
                self.logger.error(f"Error applying correction to {correction.file_path}: {e}")
                results["failed"].append({
                    "file": correction.file_path,
                    "reason": str(e)
                })
        
        return results
    
    async def _apply_single_correction(self, correction: FileCorrection) -> bool:
        """Apply a single correction"""
        try:
            file_path = Path(correction.file_path)
            
            if correction.correction_type == "style":
                return await self._fix_style_issues(file_path)
            elif correction.correction_type == "syntax":
                return await self._fix_syntax_issues(file_path, correction)
            elif correction.correction_type == "security":
                return await self._fix_security_issues(file_path, correction)
            
            return False
            
        except Exception as e:
            self.logger.error(f"Failed to apply correction: {e}")
            return False
    
    async def _fix_style_issues(self, file_path: Path) -> bool:
        """Fix style issues in file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Remove trailing whitespace
            lines = content.split('\n')
            fixed_lines = [line.rstrip() for line in lines]
            fixed_content = '\n'.join(fixed_lines)
            
            # Write back if changed
            if fixed_content != content:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(fixed_content)
                
                self.logger.info(f"Fixed style issues in {file_path}")
                return True
            
            return False
            
        except Exception as e:
            self.logger.error(f"Failed to fix style issues in {file_path}: {e}")
            return False
    
    async def _fix_syntax_issues(self, file_path: Path, correction: FileCorrection) -> bool:
        """Fix syntax issues (limited automatic fixes)"""
        # For now, we'll only log syntax issues as they require manual intervention
        self.logger.warning(f"Syntax issue in {file_path}: {correction.description}")
        return False
    
    async def _fix_security_issues(self, file_path: Path, correction: FileCorrection) -> bool:
        """Fix security issues by adding warnings"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Add security warning comment
            warning_comment = f"# SECURITY WARNING: {correction.description}\n"
            
            if not warning_comment in content:
                # Add warning at the top of the file
                lines = content.split('\n')
                if lines and lines[0].startswith('#!'):
                    # Insert after shebang
                    lines.insert(1, warning_comment.rstrip())
                else:
                    lines.insert(0, warning_comment.rstrip())
                
                fixed_content = '\n'.join(lines)
                
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(fixed_content)
                
                self.logger.info(f"Added security warning to {file_path}")
                return True
            
            return False
            
        except Exception as e:
            self.logger.error(f"Failed to fix security issues in {file_path}: {e}")
            return False

class BranchMerger:
    """Handles automated branch merging operations"""
    
    def __init__(self, repo_path: str, access_token: str = ""):
        self.repo_path = Path(repo_path)
        self.access_token = access_token
        self.logger = logging.getLogger(__name__)
        
    async def merge_branches_to_main(self, branches: List[str], target_branch: str = "main") -> Dict[str, Any]:
        """Merge multiple branches to main branch"""
        results = {
            "successful_merges": [],
            "failed_merges": [],
            "conflicts": [],
            "created_prs": []
        }
        
        for branch in branches:
            if branch == target_branch:
                continue  # Skip target branch itself
                
            try:
                merge_result = await self._merge_single_branch(branch, target_branch)
                
                if merge_result["success"]:
                    results["successful_merges"].append({
                        "branch": branch,
                        "method": merge_result["method"]
                    })
                elif merge_result["conflicts"]:
                    results["conflicts"].append({
                        "branch": branch,
                        "conflicts": merge_result["conflicts"]
                    })
                    
                    # Create PR for manual resolution
                    pr_result = await self._create_merge_pr(branch, target_branch)
                    if pr_result:
                        results["created_prs"].append(pr_result)
                else:
                    results["failed_merges"].append({
                        "branch": branch,
                        "error": merge_result.get("error", "Unknown error")
                    })
                    
            except Exception as e:
                self.logger.error(f"Error merging branch {branch}: {e}")
                results["failed_merges"].append({
                    "branch": branch,
                    "error": str(e)
                })
        
        return results
    
    async def _merge_single_branch(self, source_branch: str, target_branch: str) -> Dict[str, Any]:
        """Merge a single branch"""
        try:
            # Change to repository directory
            os.chdir(self.repo_path)
            
            # Fetch latest changes
            subprocess.run(["git", "fetch", "origin"], check=True, capture_output=True)
            
            # Checkout target branch
            subprocess.run(["git", "checkout", target_branch], check=True, capture_output=True)
            subprocess.run(["git", "pull", "origin", target_branch], check=True, capture_output=True)
            
            # Try to merge
            merge_result = subprocess.run(
                ["git", "merge", f"origin/{source_branch}", "--no-ff"],
                capture_output=True,
                text=True
            )
            
            if merge_result.returncode == 0:
                # Successful merge
                # Push changes
                push_result = subprocess.run(
                    ["git", "push", "origin", target_branch],
                    capture_output=True,
                    text=True
                )
                
                if push_result.returncode == 0:
                    self.logger.info(f"Successfully merged {source_branch} to {target_branch}")
                    return {"success": True, "method": "automatic"}
                else:
                    self.logger.error(f"Failed to push merge: {push_result.stderr}")
                    return {"success": False, "error": "Push failed"}
            else:
                # Check for conflicts
                if "CONFLICT" in merge_result.stdout or "CONFLICT" in merge_result.stderr:
                    conflicts = self._parse_merge_conflicts()
                    
                    # Abort the merge
                    subprocess.run(["git", "merge", "--abort"], capture_output=True)
                    
                    return {
                        "success": False,
                        "conflicts": conflicts,
                        "error": "Merge conflicts detected"
                    }
                else:
                    return {
                        "success": False,
                        "error": merge_result.stderr or "Unknown merge error"
                    }
                    
        except subprocess.CalledProcessError as e:
            self.logger.error(f"Git command failed: {e}")
            return {"success": False, "error": str(e)}
        except Exception as e:
            self.logger.error(f"Merge failed: {e}")
            return {"success": False, "error": str(e)}
    
    def _parse_merge_conflicts(self) -> List[str]:
        """Parse merge conflicts from git status"""
        try:
            result = subprocess.run(
                ["git", "status", "--porcelain"],
                capture_output=True,
                text=True,
                cwd=self.repo_path
            )
            
            conflicts = []
            for line in result.stdout.split('\n'):
                if line.startswith('UU ') or line.startswith('AA '):
                    conflicts.append(line[3:].strip())
            
            return conflicts
            
        except Exception as e:
            self.logger.error(f"Failed to parse conflicts: {e}")
            return []
    
    async def _create_merge_pr(self, source_branch: str, target_branch: str) -> Optional[Dict[str, Any]]:
        """Create a pull request for manual merge resolution"""
        try:
            # This would typically use GitHub API
            # For now, we'll simulate PR creation
            pr_title = f"Merge {source_branch} into {target_branch} (Conflicts)"
            pr_body = f"Automated merge of {source_branch} into {target_branch} failed due to conflicts.\n\n"
            pr_body += "Please resolve conflicts manually and complete the merge."
            
            self.logger.info(f"Would create PR: {pr_title}")
            
            return {
                "title": pr_title,
                "head_branch": source_branch,
                "base_branch": target_branch,
                "body": pr_body
            }
            
        except Exception as e:
            self.logger.error(f"Failed to create merge PR: {e}")
            return None

class GitHubAutoManager:
    """High-level manager for GitHub automation operations"""
    
    def __init__(self, repo_config: GitHubRepository):
        self.repo_config = repo_config
        self.logger = logging.getLogger(__name__)
        self.api_client = GitHubAPIClient(repo_config.access_token)
        self.file_analyzer = FileAnalyzer()
        self.auto_corrector = AutoCorrector()
        self.repo_path = Path(f"/home/ubuntu/github_repos/{repo_config.name}")
        
    async def analyze_and_correct_files(self, file_patterns: List[str] = None) -> Dict[str, Any]:
        """Analyze and correct files in the repository"""
        if file_patterns is None:
            file_patterns = ["*.py", "*.yaml", "*.yml", "*.json"]
        
        results = {
            "analyzed_files": [],
            "corrections_found": [],
            "corrections_applied": [],
            "summary": {}
        }
        
        try:
            # Find files to analyze
            files_to_analyze = []
            for pattern in file_patterns:
                files_to_analyze.extend(self.repo_path.glob(f"**/{pattern}"))
            
            # Analyze each file
            all_corrections = []
            for file_path in files_to_analyze:
                if file_path.suffix == '.py':
                    corrections = await self.file_analyzer.analyze_python_file(file_path)
                elif file_path.suffix in ['.yaml', '.yml']:
                    corrections = await self.file_analyzer.analyze_yaml_file(file_path)
                elif file_path.suffix == '.json':
                    corrections = await self.file_analyzer.analyze_json_file(file_path)
                else:
                    continue
                
                results["analyzed_files"].append(str(file_path))
                
                if corrections:
                    results["corrections_found"].extend([asdict(c) for c in corrections])
                    all_corrections.extend(corrections)
            
            # Apply corrections
            if all_corrections:
                correction_results = await self.auto_corrector.apply_corrections(all_corrections)
                results["corrections_applied"] = correction_results
            
            # Generate summary
            results["summary"] = {
                "files_analyzed": len(results["analyzed_files"]),
                "corrections_found": len(results["corrections_found"]),
                "corrections_applied": len(results["corrections_applied"].get("applied", [])),
                "corrections_failed": len(results["corrections_applied"].get("failed", [])),
                "corrections_skipped": len(results["corrections_applied"].get("skipped", []))
            }
            
            self.logger.info(f"File analysis complete: {results['summary']}")
            
        except Exception as e:
            self.logger.error(f"File analysis and correction failed: {e}")
            results["error"] = str(e)
        
        return results
    
    async def merge_all_branches(self, target_branch: str = "main") -> Dict[str, Any]:
        """Merge all branches to target branch"""
        try:
            # Get list of branches
            branches = await self.api_client.list_branches(
                self.repo_config.owner, 
                self.repo_config.name
            )
            
            if not branches:
                return {"error": "No branches found"}
            
            # Initialize branch merger
            merger = BranchMerger(str(self.repo_path), self.repo_config.access_token)
            
            # Merge branches
            merge_results = await merger.merge_branches_to_main(branches, target_branch)
            
            self.logger.info(f"Branch merging complete: {len(merge_results['successful_merges'])} successful, "
                           f"{len(merge_results['failed_merges'])} failed, "
                           f"{len(merge_results['conflicts'])} conflicts")
            
            return merge_results
            
        except Exception as e:
            self.logger.error(f"Branch merging failed: {e}")
            return {"error": str(e)}
    
    async def full_automation_workflow(self) -> Dict[str, Any]:
        """Run complete automation workflow"""
        workflow_results = {
            "file_analysis": {},
            "branch_merging": {},
            "summary": {},
            "timestamp": time.time()
        }
        
        try:
            self.logger.info("Starting full automation workflow")
            
            # Step 1: Analyze and correct files
            self.logger.info("Step 1: Analyzing and correcting files")
            workflow_results["file_analysis"] = await self.analyze_and_correct_files()
            
            # Step 2: Merge branches
            self.logger.info("Step 2: Merging branches")
            workflow_results["branch_merging"] = await self.merge_all_branches()
            
            # Generate overall summary
            workflow_results["summary"] = {
                "files_processed": workflow_results["file_analysis"].get("summary", {}).get("files_analyzed", 0),
                "corrections_applied": workflow_results["file_analysis"].get("summary", {}).get("corrections_applied", 0),
                "branches_merged": len(workflow_results["branch_merging"].get("successful_merges", [])),
                "merge_conflicts": len(workflow_results["branch_merging"].get("conflicts", [])),
                "prs_created": len(workflow_results["branch_merging"].get("created_prs", []))
            }
            
            self.logger.info(f"Automation workflow complete: {workflow_results['summary']}")
            
        except Exception as e:
            self.logger.error(f"Automation workflow failed: {e}")
            workflow_results["error"] = str(e)
        
        return workflow_results

class GitHubAutomation:
    """Simple wrapper class for GitHub automation functionality"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    def get_status(self) -> Dict[str, Any]:
        """Get automation status"""
        return {
            "status": "ready",
            "features": [
                "File analysis and correction",
                "Branch merging",
                "Pull request management"
            ]
        }

# Example usage and testing
if __name__ == "__main__":
    async def main():
        # Initialize GitHub automation
        repo_config = GitHubRepository(
            owner="dfultonthebar",
            name="Sports-Bar-TV-Controller",
            access_token="your_token_here"
        )
        
        github_manager = GitHubAutoManager(repo_config)
        
        # Run file analysis
        print("Running file analysis...")
        analysis_results = await github_manager.analyze_and_correct_files()
        print(f"Analysis complete: {analysis_results['summary']}")
        
        # Run branch merging
        print("\nRunning branch merging...")
        merge_results = await github_manager.merge_all_branches()
        print(f"Merging complete: {len(merge_results.get('successful_merges', []))} successful")
    
    asyncio.run(main())
