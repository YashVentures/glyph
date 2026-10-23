import re
import defusedxml.ElementTree as ET
from fastapi import HTTPException

MAX_SVG_SIZE_BYTES = 1024 * 1024  # 1 MB

DANGEROUS_ELEMENTS = {
    'script', 'iframe', 'object', 'embed', 'foreignobject', 'style', 'link', 'meta'
}

DANGEROUS_ATTRIBUTES = {
    'onload', 'onerror', 'onclick', 'onmouseover', 'onmouseout',
    'onmouseenter', 'onmouseleave', 'onfocus', 'onblur', 'onchange'
}

def sanitize_svg(svg_content: str) -> str:
    # 1. Size limit validation (max 1MB)
    if len(svg_content.encode('utf-8')) > MAX_SVG_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail="SVG payload exceeds maximum allowed size of 1MB."
        )

    # 2. Check for script tags or DOCTYPE entities
    lower = svg_content.lower()
    if '<script' in lower or 'javascript:' in lower:
        raise HTTPException(
            status_code=400,
            detail="Dangerous script tags or javascript URIs found in SVG."
        )

    # 3. Strip DOCTYPE and XML prolog if present
    cleaned = re.sub(r'<\?xml[^>]*\?>', '', svg_content, flags=re.IGNORECASE)
    cleaned = re.sub(r'<!DOCTYPE[^>]*>', '', cleaned, flags=re.IGNORECASE)
    cleaned = cleaned.strip()

    if not (cleaned.startswith('<svg') or cleaned.startswith('<SVG')):
        raise HTTPException(status_code=400, detail="Invalid SVG root element.")

    # 4. XML Parsing and tree cleansing via defusedxml
    try:
        root = ET.fromstring(cleaned)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"SVG XML malformed: {str(e)}")

    def clean_element(elem):
        # Strip namespace for tag check
        tag = elem.tag.split('}')[-1].lower() if '}' in elem.tag else elem.tag.lower()
        if tag in DANGEROUS_ELEMENTS:
            return False

        # Clean attributes
        attrs_to_remove = []
        for attr, val in list(elem.attrib.items()):
            attr_name = attr.lower()
            val_str = str(val).lower()
            if attr_name.startswith('on') or attr_name in DANGEROUS_ATTRIBUTES:
                attrs_to_remove.append(attr)
            elif 'javascript:' in val_str or 'data:text/html' in val_str:
                attrs_to_remove.append(attr)

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

    clean_element(root)

    return ET.tostring(root, encoding='unicode')
