import random
import json

# ==================== Analysis & Configuration ====================
# Derived from Shein/Pinterest trend analysis (Manga, Coquette, Camo, Y2K, Dopamine)

CATEGORIES = {
    "coquette": {
        "label_base": "Coquette",
        "desc_base": "Bows/Lace/Pearls",
        "elements": ["satin bows", "pearl strings", "lace trim", "roses", "hearts", "swans", "ballet shoes"],
        "colors": ["baby pink", "cream", "white", "mocha", "powder blue", "lilac"],
        "layouts": ["tossed bows", "dense lace repeat", "scattered pearls"],
        "vibes": ["hyper-feminine", "delicate", "romantic", "soft", "vintage"],
        "tags": ["少女", "蝴蝶结", "芭蕾", "流行"]
    },
    "y2k_mcbling": {
        "label_base": "Y2K McBling",
        "desc_base": "Rhinestones/Velvet/Slogans",
        "elements": ["rhinestone hearts", "butterflies", "stars", "gothic lettering", "crowns", "flip phones", "cherries"],
        "colors": ["hot pink", "silver", "black", "purple", "baby blue", "lime green"],
        "layouts": ["sticker bomb", "centered slogan with icons", "all-over monogram"],
        "vibes": ["glamorous", "sassy", "retro-futuristic", "sparkly"],
        "tags": ["Y2K", "千禧", "辣妹", "水钻", "流行"]
    },
    "anime_manga": {
        "label_base": "Anime Manga",
        "desc_base": "Manga/Halftone/Speedlines",
        "elements": ["manga eyes", "speed lines", "speech bubbles", "magical girl wands", "sparkles", "school uniform elements", "chibi characters"],
        "colors": ["black and white", "bw with neon pink", "pastel purple", "cyan"],
        "layouts": ["manga panel collage", "large character print", "scattered kawaii icons"],
        "vibes": ["cool", "dramatic", "cute", "edgy"],
        "tags": ["动漫", "漫画", "二次元", "流行"]
    },
    "street_camo": {
        "label_base": "Street Camo",
        "desc_base": "Camo/Graffiti/Distressed",
        "elements": ["camouflage blobs", "graffiti tags", "spray paint drips", "barbed wire", "chains", "skulls"],
        "colors": ["forest green", "pink camo", "purple camo", "grey scale", "orange safety"],
        "layouts": ["all-over camo", "patchwork camo", "stencil spray"],
        "vibes": ["tough", "streetwear", "trendy", "bold"],
        "tags": ["迷彩", "街头", "潮流", "工装"]
    },
    "dopamine_kidcore": {
        "label_base": "Dopamine",
        "desc_base": "Rainbow/Smiles/TieDye",
        "elements": ["smiley faces", "rainbows", "flowers", "clouds", "bears", "lollipops", "tie-dye swirls"],
        "colors": ["rainbow", "neon brights", "tie-dye pastel", "sunflower yellow"],
        "layouts": ["tie-dye background", "dense sticker scatter", "checkerboard mix"],
        "vibes": ["happy", "playful", "bright", "energetic"],
        "tags": ["多巴胺", "彩虹", "快乐", "童趣"]
    },
     "pop_culture_meme": {
        "label_base": "Pop Meme",
        "desc_base": "Funny/Irony/Text",
        "elements": ["funny chickens", "bananas", "sunglasses", "pixel art", "memetic text", "cats"],
        "colors": ["primary red", "yellow", "white", "blue"],
        "layouts": ["central mascot", "text heavy repeat", "grid of memes"],
        "vibes": ["humorous", "ironic", "viral", "fun"],
        "tags": ["趣味", "梗", "流行", "搞笑"]
    }
}

# ==================== Generator Logic ====================

def generate_presets(count=300):
    presets = []
    generated_ids = set()
    
    # Calculate distribution
    per_category = count // len(CATEGORIES)
    remainder = count % len(CATEGORIES)
    
    for cat_key, cat_data in CATEGORIES.items():
        num_to_gen = per_category + (1 if remainder > 0 else 0)
        remainder -= 1
        
        for i in range(num_to_gen):
            # Randomize attributes
            element1 = random.choice(cat_data["elements"])
            element2 = random.choice(cat_data["elements"])
            while element1 == element2:
                element2 = random.choice(cat_data["elements"])
                
            color_scheme = random.choice(cat_data["colors"])
            layout = random.choice(cat_data["layouts"])
            vibe = random.choice(cat_data["vibes"])
            
            # Construct ID
            unique_suffix = f"{i+1}"
            preset_id = f"{cat_key}_{element1.replace(' ', '_')}_{unique_suffix}"
            
            # Ensure uniqueness
            if preset_id in generated_ids:
                preset_id = f"{preset_id}_{random.randint(100,999)}"
            generated_ids.add(preset_id)
            
            # Construct Label & Description
            label = f"{cat_data['label_base']} {element1.title()}"
            name_en = f"{cat_data['label_base']} {element1.title()} {i+1}"
            description = f"{element1}/{element2} - {color_scheme}"
            
            # Construct Prompt
            prompt = (
                f"Style: {cat_data['label_base']} aesthetic ({vibe}). "
                f"Layout: {layout}. "
                f"Colors: {color_scheme}. "
                f"Elements: {element1}, {element2}. "
                f"Vibe: {vibe}."
            )
            
            # Construct Object
            preset = {
                "id": preset_id,
                "label": label,
                "nameEn": name_en,
                "description": description,
                "prompt": prompt,
                "tags": cat_data["tags"] + ["Pattern", "2025Trend"],
                "category": "lifestyle" if cat_key in ["coquette", "y2k_mcbling", "street_camo"] else "pattern"
            }
            presets.append(preset)
            
    return presets

# ==================== Output Formatting ====================

def format_typescript(presets):
    lines = []
    lines.append("// Generated Trend Presets 2025")
    for p in presets:
        lines.append(f"  // {p['id']}")
        lines.append(f"  {p['id']}: {{")
        lines.append(f"    id: '{p['id']}',")
        lines.append(f"    label: '{p['label']}',")
        lines.append(f"    nameEn: '{p['nameEn']}',")
        lines.append(f"    description: '{p['description']}',")
        lines.append(f"    prompt: '{p['prompt']}',")
        lines.append(f"    tags: {json.dumps(p['tags'], ensure_ascii=False)},")
        lines.append(f"    category: '{p['category']}'")
        lines.append("  },")
        lines.append("")
    return "\n".join(lines)

if __name__ == "__main__":
    presets = generate_presets(300)
    ts_content = format_typescript(presets)
    
    with open("e:/1/cherry/ai-workflow/cherry-studio/src/renderer/src/pages/workflow/presets/trending_2025.ts", "w", encoding="utf-8") as f:
        f.write(ts_content)
    
    print(f"Generated {len(presets)} presets.")
