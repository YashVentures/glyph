import re
import defusedxml.ElementTree as ET
from fastapi import HTTPException

MAX_SVG_SIZE_BYTES = 1024 * 1024  # 1 MB

DANGEROUS_ELEMENTS = {
    'script', 'iframe', 'object', 'embed', 'foreignobject', 'link', 'meta', 'base'
}

DANGEROUS_ATTRIBUTES = {
    'onload', 'onerror', 'onclick', 'onmouseover', 'onmouseout',
    'onmouseenter', 'onmouseleave', 'onfocus', 'onblur', 'onchange',
    'onabort', 'onactivate', 'onbeforecopy', 'onbeforecut', 'onbeforepaste',
    'oncopy', 'oncut', 'onpaste', 'ondrag', 'ondragend', 'ondragenter',
    'ondragleave', 'ondragover', 'ondragstart', 'ondrop', 'onkeydown',
    'onkeypress', 'onkeyup', 'onmousedown', 'onmousemove', 'onmouseup'
}

def sanitize_svg(svg_content: str) -> str:
    # 1. Size limit validation (max 1MB)
    encoded = svg_content.encode('utf-8')
    if len(encoded) > MAX_SVG_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail="SVG payload exceeds maximum allowed size of 1MB."
        )

    # 2. Check for hostile raw strings / javascript URLs
    lower_content = svg_content.lower()
    if 'javascript:' in lower_content:
        raise HTTPException(
            status_code=400,
            detail="Dangerous javascript URI detected in SVG payload."
        )

    # 3. Strip DOCTYPE and XML prolog if present, preventing XXE & external entity injection
    cleaned = re.sub(r'<\?xml[^>]*\?>', '', svg_content, flags=re.IGNORECASE)
    cleaned = re.sub(r'<!DOCTYPE[^>]*(\[[^\]]*\])?>', '', cleaned, flags=re.IGNORECASE | re.DOTALL)
    cleaned = cleaned.strip()

    if not (cleaned.startswith('<svg') or cleaned.startswith('<SVG')):
        raise HTTPException(status_code=400, detail="Invalid SVG root element.")

    # 4. XML Parsing and tree cleansing via defusedxml
    try:
        root = ET.fromstring(cleaned)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"SVG XML malformed or rejected: {str(e)}")

    def clean_element(elem):
        # Extract tag without XML namespace
        tag = elem.tag.split('}')[-1].lower() if '}' in elem.tag else elem.tag.lower()
        if tag in DANGEROUS_ELEMENTS:
            return False

        # If it's a <style> block, inspect its text for external imports or url() references
        if tag == 'style':
            text = (elem.text or '').lower()
            if '@import' in text or 'url(' in text:
                return False

        # Inspect and clean attributes
        attrs_to_remove = []
        for attr, val in list(elem.attrib.items()):
            attr_name = attr.split('}')[-1].lower() if '}' in attr else attr.lower()
            val_str = str(val).strip().lower()

            # Strip event handlers (starts with 'on')
            if attr_name.startswith('on') or attr_name in DANGEROUS_ATTRIBUTES:
                attrs_to_remove.append(attr)
                continue

            # Check style attributes for url(), @import, or javascript:
            if attr_name == 'style':
                if 'url(' in val_str or '@import' in val_str or 'javascript:' in val_str:
                    attrs_to_remove.append(attr)
                    continue

            # Strip external references in href or xlink:href (allow only internal references starting with '#')
            if attr_name in ('href', 'xlink:href'):
                if not val_str.startswith('#'):
                    attrs_to_remove.append(attr)
                    continue

            # Strip data: or javascript: in any attribute
            if 'javascript:' in val_str or ('data:' in val_str and not val_str.startswith('data:image/')):
                attrs_to_remove.append(attr)
                continue

        for a in attrs_to_remove:
            del elem.attrib[a]

        # Recursively clean children
        children_to_remove = []
        for child in list(elem):
            if not clean_element(child):
                children_to_remove.append(child)

        for child in children_to_remove:
            elem.remove(child)

        return True

    if not clean_element(root):
        raise HTTPException(status_code=400, detail="Root SVG element is forbidden.")

    # Ensure SVG has xmlns attributes if needed
    if 'xmlns' not in root.attrib:
        root.attrib['xmlns'] = "http://www.w3.org/2000/svg"

    return ET.tostring(root, encoding='unicode')
