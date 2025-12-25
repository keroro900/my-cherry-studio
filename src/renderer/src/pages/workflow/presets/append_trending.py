import os

target_file = 'e:/1/cherry/ai-workflow/cherry-studio/src/renderer/src/pages/workflow/presets/pattern.ts'
source_file = 'e:/1/cherry/ai-workflow/cherry-studio/src/renderer/src/pages/workflow/presets/trending_2025.ts'

def append_presets():
    if not os.path.exists(target_file):
        print(f"Error: Target file not found: {target_file}")
        return
    if not os.path.exists(source_file):
        print(f"Error: Source file not found: {source_file}")
        return

    with open(target_file, 'r', encoding='utf-8') as f:
        target_content = f.read()

    with open(source_file, 'r', encoding='utf-8') as f:
        new_presets = f.read()

    # Find the marker "export const COMPLEX_PATTERN_STYLE_PRESETS"
    marker = "export const COMPLEX_PATTERN_STYLE_PRESETS"
    split_point = target_content.find(marker)
    
    if split_point == -1:
        print("Error: Could not find marker in file.")
        return

    # Find the last '}' before the marker
    insert_point = target_content.rfind('}', 0, split_point)
    
    if insert_point == -1:
        print("Error: Could not find closing brace before marker.")
        return
        
    print(f"Found marker at index {split_point}")
    print(f"Found insertion point at index {insert_point}")

    # Check context around insertion point
    # We want to verify if we need a comma.
    # We will look backwards from insert_point, skipping whitespace/newlines
    
    pre_content = target_content[:insert_point]
    post_content = target_content[insert_point:]
    
    pre_content_stripped = pre_content.rstrip()
    
    # If the last character isn't a comma or opening brace, add a comma
    if not pre_content_stripped.endswith(',') and not pre_content_stripped.endswith('{'):
        new_presets = ",\n" + new_presets
        print("Added comma prefix.")
    
    final_content = pre_content + "\n" + new_presets + "\n" + post_content
    
    with open(target_file, 'w', encoding='utf-8') as f:
        f.write(final_content)
    
    print("Successfully appended 300 presets.")

if __name__ == '__main__':
    append_presets()
