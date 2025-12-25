import os
import re

target_file = 'e:/1/cherry/ai-workflow/cherry-studio/src/renderer/src/pages/workflow/presets/pattern.ts'
source_file = 'e:/1/cherry/ai-workflow/cherry-studio/src/renderer/src/pages/workflow/presets/extra_presets_3.ts'

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

    # Find the end of COMPLEX_PATTERN_STYLE_DEFINITIONS
    # We look for the export const COMPLEX_PATTERN_STYLE_PRESETS and find the closing brace before it
    pattern = r'(}\s*)(\n\s*/\*\*\s*\n\s*\*\s*复杂图案风格预设注册表)'
    
    match = re.search(pattern, target_content)
    
    if match:
        start_idx = match.start(1)
        # We want to insert before the closing brace '}'
        # Actually, match.group(1) is '}\s*'.
        # We want to insert *before* this closing brace, or *inside* it?
        # The object is defined as const X = { ... };
        # So we need to insert before the last '}' of that object.
        
        # Let's try a different approach. Find the definition start, then find the matching closing brace?
        # Or simpler: Find "export const COMPLEX_PATTERN_STYLE_PRESETS" and search backwards for the first "}"
        
        split_point = target_content.find("export const COMPLEX_PATTERN_STYLE_PRESETS")
        if split_point == -1:
             print("Error: Could not find COMPLEX_PATTERN_STYLE_PRESETS definition")
             return

        # Search backwards from split_point for the last '}'
        # This '}' closes COMPLEX_PATTERN_STYLE_DEFINITIONS
        insert_point = target_content.rfind('}', 0, split_point)
        
        if insert_point != -1:
            # Check if there is a comma before the new presets (if the previous item didn't have one? Typescript objects usually allow trailing commas)
            # To be safe, we can add a comma before our new content if needed, but usually we just append.
            # Let's ensure the previous line ends with a comma or we add one.
            
            # Actually, simpler: Insert before the '}'
            # We should add a comma to the previous item just in case, but hard to know where it is without parsing.
            # However, if we look at the file, the last item 'st_patricks' probably doesn't have a trailing comma if it was the last one?
            # Or maybe it does. The previous migration might not have added a trailing comma to the last item.
            
            # Let's peek at the character before '}' (ignoring whitespace)
            # But wait, my previous append script might have left a trailing comma?
            # Let's just prepend a comma to our new_presets string to be safe? 
            # " , \n ... new presets "
            # If there was already a comma, double comma might be an issue? Typescript/JS allows trailing comma but not double comma ,, 
            
            # Let's just insert it. If there is a syntax error, we can fix it.
            # Better: Check if the character before insert_point (skipping whitespace) is a comma.
            
            pre_content = target_content[:insert_point]
            post_content = target_content[insert_point:]
            
            # strip trailing whitespace from pre_content to check last char
            pre_content_stripped = pre_content.rstrip()
            if not pre_content_stripped.endswith(',') and not pre_content_stripped.endswith('{'):
                # Add comma if not present and not empty object
                new_presets = ",\n" + new_presets
            
            final_content = pre_content + "\n" + new_presets + "\n" + post_content
            
            with open(target_file, 'w', encoding='utf-8') as f:
                f.write(final_content)
            print("Successfully appended presets.")
            
        else:
            print("Error: Could not find closing brace of COMPLEX_PATTERN_STYLE_DEFINITIONS")
    else:
        # Fallback if regex didn't match (maybe comments changed?)
        # Let's try the simple string search method used above
        split_point = target_content.find("export const COMPLEX_PATTERN_STYLE_PRESETS")
        if split_point != -1:
             insert_point = target_content.rfind('}', 0, split_point)
             if insert_point != -1:
                pre_content = target_content[:insert_point]
                post_content = target_content[insert_point:]
                pre_content_stripped = pre_content.rstrip()
                if not pre_content_stripped.endswith(',') and not pre_content_stripped.endswith('{'):
                    new_presets = ",\n" + new_presets
                final_content = pre_content + "\n" + new_presets + "\n" + post_content
                with open(target_file, 'w', encoding='utf-8') as f:
                    f.write(final_content)
                print("Successfully appended presets (fallback method).")
             else:
                 print("Error: Could not find closing brace (fallback).")
        else:
            print("Error: Could not find marker in file.")

if __name__ == '__main__':
    append_presets()
