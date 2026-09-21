#!/usr/bin/env python3
"""
EXPLAIN analyzer for PostgreSQL, MySQL, and SQLite.
Reads EXPLAIN output, highlights bottlenecks, suggests indexes.

Usage:
  python analyze-explain.py postgres explain.txt
  python analyze-explain.py mysql explain.json
  python analyze-explain.py sqlite explain.txt
"""

import sys
import json
import re
from typing import Dict, List, Tuple

def analyze_postgres_explain(plan_text: str) -> Dict:
    """Parse PostgreSQL EXPLAIN (FORMAT TEXT) output."""
    issues = []
    suggestions = []
    
    lines = plan_text.strip().split('\n')
    
    # Check for sequential scans
    for line in lines:
        if 'Seq Scan' in line:
            # Extract table name
            match = re.search(r'Seq Scan on (\w+)', line)
            if match:
                table = match.group(1)
                issues.append(f"Sequential scan on '{table}' - no index used")
                suggestions.append(f"Consider adding an index on '{table}' for the WHERE clause columns")
    
    # Check for sorts
    for line in lines:
        if 'Sort' in line and 'external' in line.lower():
            issues.append("Sort spilled to disk (external sort) - increase work_mem or reduce result set")
    
    # Check for nested loops with high row counts
    for i, line in enumerate(lines):
        if 'Nested Loop' in line:
            # Look for row estimates
            match = re.search(r'rows=(\d+)', line)
            if match and int(match.group(1)) > 1000:
                issues.append(f"Nested loop with {match.group(1)} estimated rows - consider a hash join instead")
                suggestions.append("Increase work_mem or rewrite query to enable hash join")
    
    # Check for missing statistics
    for line in lines:
        if 'rows=' in line:
            match = re.search(r'rows=(\d+).*actual.*rows=(\d+)', line)
            if match:
                estimated = int(match.group(1))
                actual = int(match.group(2))
                if estimated > 0 and abs(estimated - actual) / estimated > 10:
                    issues.append(f"Row estimate way off: {estimated} estimated vs {actual} actual")
                    suggestions.append("Run ANALYZE on this table to update statistics")
    
    return {
        'database': 'PostgreSQL',
        'issues': issues,
        'suggestions': suggestions,
        'summary': f"Found {len(issues)} potential issues"
    }

def analyze_mysql_explain(plan: Dict) -> Dict:
    """Parse MySQL EXPLAIN (FORMAT=JSON) output."""
    issues = []
    suggestions = []
    
    def walk_plan(node, depth=0):
        if isinstance(node, dict):
            # Check for full table scans
            if node.get('access_type') == 'ALL':
                table = node.get('table_name', 'unknown')
                rows = node.get('rows_examined_per_scan', 0)
                issues.append(f"Full table scan on '{table}' ({rows} rows examined)")
                suggestions.append(f"Add index on '{table}' for the join/where condition")
            
            # Check for filesort
            if 'using_filesort' in node and node['using_filesort']:
                issues.append("Using filesort (sort not using index) - consider adding composite index for ORDER BY")
            
            # Check for temp tables
            if 'using_temporary_table' in node and node['using_temporary_table']:
                issues.append("Using temporary table - query may benefit from better indexing")
            
            for value in node.values():
                walk_plan(value, depth + 1)
        
        elif isinstance(node, list):
            for item in node:
                walk_plan(item, depth)
    
    walk_plan(plan)
    
    return {
        'database': 'MySQL',
        'issues': issues,
        'suggestions': suggestions,
        'summary': f"Found {len(issues)} potential issues"
    }

def analyze_sqlite_explain(plan_text: str) -> Dict:
    """Parse SQLite EXPLAIN QUERY PLAN output."""
    issues = []
    suggestions = []
    
    lines = plan_text.strip().split('\n')
    
    for line in lines:
        # Check for table scans
        if 'SCAN TABLE' in line:
            match = re.search(r'SCAN TABLE (\w+)', line)
            if match:
                table = match.group(1)
                issues.append(f"Full table scan on '{table}'")
                suggestions.append(f"Consider adding an index on '{table}'")
        
        # Check for temp b-trees
        if 'USE TEMP B-TREE' in line:
            issues.append("Temporary B-tree created for ORDER BY - add index matching the sort order")
    
    return {
        'database': 'SQLite',
        'issues': issues,
        'suggestions': suggestions,
        'summary': f"Found {len(issues)} potential issues"
    }

def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    
    db_type = sys.argv[1].lower()
    plan_file = sys.argv[2]
    
    with open(plan_file, 'r') as f:
        content = f.read()
    
    if db_type == 'postgres':
        result = analyze_postgres_explain(content)
    elif db_type == 'mysql':
        plan = json.loads(content)
        result = analyze_mysql_explain(plan)
    elif db_type == 'sqlite':
        result = analyze_sqlite_explain(content)
    else:
        print(f"Unknown database type: {db_type}")
        print("Supported: postgres, mysql, sqlite")
        sys.exit(1)
    
    print(f"\n{result['database']} EXPLAIN Analysis")
    print("=" * 60)
    print(f"\n{result['summary']}\n")
    
    if result['issues']:
        print("Issues found:")
        for i, issue in enumerate(result['issues'], 1):
            print(f"  {i}. {issue}")
    
    if result['suggestions']:
        print("\nSuggestions:")
        for i, sug in enumerate(result['suggestions'], 1):
            print(f"  {i}. {sug}")
    
    if not result['issues']:
        print("✓ No obvious issues found. Query plan looks reasonable.")

if __name__ == '__main__':
    main()
