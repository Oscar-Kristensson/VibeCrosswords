import base64
import mimetypes

# ==========================================
# 1. Configuration
# ==========================================
INPUT_HTML = "index.html"
OUTPUT_SHTML = "vibe_crosswords.shtml"

# Simply list the exact files you want to bundle into the HTML
FILES_TO_INLINE = [
    "css/styles.css",
    "js/arrows.js",
    "js/grid.js",
    "js/main.js",
    "js/pdf.js",
    "js/serialiser.js",
    "js/state.js",
    "js/ui.js",
    "js/words.js",
]

# ==========================================
# 2. Run the Bundler
# ==========================================
# Read the original HTML file
with open(INPUT_HTML, 'r', encoding='utf-8') as file:
    html_content = file.read()

# Process each file in your list
for filename in FILES_TO_INLINE:
    try:
        if filename.endswith('.css'):
            with open(filename, 'r', encoding='utf-8') as f:
                # Find the exact link tag and replace it with a style block
                target_tag = f'<link rel="stylesheet" href="{filename}">'
                new_tag = f'<style>\n{f.read()}\n</style>'
                html_content = html_content.replace(target_tag, new_tag)
                
        elif filename.endswith('.js'):
            with open(filename, 'r', encoding='utf-8') as f:
                # Find the exact script tag and replace it with an inline script block
                target_tag = f'<script src="{filename}"></script>'
                new_tag = f'<script>\n{f.read()}\n</script>'
                html_content = html_content.replace(target_tag, new_tag)
                
        else: 
            # Treat anything else (like .png, .jpg, .svg) as an image
            mime_type, _ = mimetypes.guess_type(filename)
            with open(filename, 'rb') as f:
                encoded_string = base64.b64encode(f.read()).decode('utf-8')
                
                # Find the filename wrapped in quotes and swap it for the Base64 data URI
                target_src = f'"{filename}"' 
                new_src = f'"data:{mime_type};base64,{encoded_string}"'
                html_content = html_content.replace(target_src, new_src)
                
        print(f"Inlined: {filename}")
        
    except FileNotFoundError:
        print(f"Warning: Could not find '{filename}' on disk. Skipping.")

# Save the final bundled text to the new .shtml file
with open(OUTPUT_SHTML, 'w', encoding='utf-8') as file:
    file.write(html_content)

print(f"\nSuccess! Single-file website saved to: {OUTPUT_SHTML}")