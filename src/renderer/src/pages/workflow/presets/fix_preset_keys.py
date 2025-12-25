import re
import os

file_path = 'e:/1/cherry/ai-workflow/cherry-studio/src/renderer/src/pages/workflow/presets/pattern.ts'

def fix_keys():
    if not os.path.exists(file_path):
        print(f"Error: File not found: {file_path}")
        return

    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    new_lines = []
    # Regex to capture unquoted keys followed by ": {"
    # We look for leading whitespace, then a key consisting of alphanumeric, underscore, or hyphen
    # then ": {"
    pattern = re.compile(r"^(\s*)([a-zA-Z0-9_\-]+)(\s*:\s*\{)")
    
    count = 0
    for line in lines:
        match = pattern.match(line)
        if match:
            indent = match.group(1)
            key = match.group(2)
            suffix = match.group(3)
            
            # If key contains hyphen, it must be quoted
            if '-' in key:
                new_line = f"{indent}'{key}'{suffix}\n"
                new_lines.append(new_line)
                count += 1
            else:
                new_lines.append(line)
        else:
            new_lines.append(line)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)

    print(f"Fixed {count} keys with hyphens.")

if __name__ == "__main__":
    fix_keys()
