"""
Generate iods.json with all Storage SOP Classes from pydicom.
Preserves existing module definitions for CT and MR, adds all others with empty modules.
"""
import json
import re
import pydicom.uid as uid

# Load existing iods.json to preserve module definitions (only keep entries with actual modules)
with open('src/dictionary/data/iods.json', 'r') as f:
    existing = json.load(f)

existing_map = {entry['sopClassUID']: entry for entry in existing if entry.get('modules')}

# Convert CamelCase to human-readable name (fallback if .name not available)
def camel_to_name(name: str) -> str:
    # Remove trailing "Storage"
    name = re.sub(r'Storage$', '', name)
    # Insert space before uppercase letters
    name = re.sub(r'([a-z])([A-Z])', r'\1 \2', name)
    name = re.sub(r'([A-Z]+)([A-Z][a-z])', r'\1 \2', name)
    return name.strip()

# Collect all Storage SOP Classes
sop_classes = []
for name in sorted(dir(uid)):
    if name.startswith('_'):
        continue
    val = getattr(uid, name)
    if isinstance(val, uid.UID) and 'Storage' in name:
        uid_str = str(val)
        if uid_str in existing_map:
            # Preserve existing definition with modules
            sop_classes.append(existing_map[uid_str])
        else:
            # Use pydicom's .name property for the official name
            sop_class_name = val.name if hasattr(val, 'name') and val.name else camel_to_name(name)
            sop_classes.append({
                'sopClassUID': uid_str,
                'sopClassName': sop_class_name,
                'modules': []
            })

# Sort by UID
sop_classes.sort(key=lambda x: x['sopClassUID'])

with open('src/dictionary/data/iods.json', 'w') as f:
    json.dump(sop_classes, f, indent=2)

print(f"Generated iods.json with {len(sop_classes)} SOP Classes")
print(f"  - {sum(1 for s in sop_classes if s['modules'])} with module definitions")
print(f"  - {sum(1 for s in sop_classes if not s['modules'])} with empty modules (stub)")
