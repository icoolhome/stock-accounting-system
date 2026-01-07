#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Create GitHub Release vS0005"""
import subprocess
import sys
import os

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    notes_file = "GITHUB_RELEASE_vS0005.md"
    
    if not os.path.exists(notes_file):
        print(f"[ERROR] File not found: {notes_file}")
        sys.exit(1)
    
    # Read release notes with UTF-8 encoding
    with open(notes_file, 'r', encoding='utf-8') as f:
        notes_content = f.read()
    
    print("[OK] Read release notes file")
    print("\nCreating release...")
    
    # Create release using GitHub CLI
    try:
        # First, delete existing release if exists
        subprocess.run(
            ['gh', 'release', 'delete', 'vS0005', '--yes'],
            capture_output=True,
            check=False
        )
        
        # Create new release
        result = subprocess.run(
            ['gh', 'release', 'create', 'vS0005',
             '--title', 'vS0005 - 持有成本顯示優化與使用指南增強',
             '--notes', notes_content,
             '--target', 'main'],
            capture_output=True,
            text=True,
            encoding='utf-8'
        )
        
        if result.returncode == 0:
            print("\n[SUCCESS] Release vS0005 created successfully!")
            print("\nView release: https://github.com/icoolhome/stock-accounting-system/releases/tag/vS0005")
        else:
            print(f"\n[ERROR] Failed to create release")
            print(f"Error: {result.stderr}")
            sys.exit(1)
            
    except Exception as e:
        print(f"\n[ERROR] Error occurred: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()

