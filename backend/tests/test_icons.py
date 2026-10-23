import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_custom_icon_crud_and_security_headers():
    # 1. Upload valid SVG icon
    valid_svg = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="blue"/></svg>'
    upload_res = client.post("/api/v1/icons", json={
        "name": "acme-logo",
        "svgContent": valid_svg
    })
    assert upload_res.status_code == 201
    icon = upload_res.json()["icon"]
    assert icon["name"] == "acme-logo"
    icon_id = icon["id"]

    # 2. List icons and verify presence
    list_res = client.get("/api/v1/icons")
    assert list_res.status_code == 200
    icons = list_res.json()["icons"]
    assert any(i["name"] == "acme-logo" for i in icons)

    # 3. Serve raw icon directly and verify strict security headers
    raw_res = client.get(f"/api/v1/icons/{icon_id}/raw")
    assert raw_res.status_code == 200
    assert "image/svg+xml" in raw_res.headers["content-type"]
    assert raw_res.headers["x-content-type-options"] == "nosniff"
    assert "default-src 'none'" in raw_res.headers["content-security-policy"]
    assert "sandbox" in raw_res.headers["content-security-policy"]

    # Also verify serving by name
    raw_by_name = client.get("/api/v1/icons/acme-logo/raw")
    assert raw_by_name.status_code == 200

    # 4. Rename icon
    rename_res = client.patch(f"/api/v1/icons/{icon_id}", json={"name": "acme-corporate-logo"})
    assert rename_res.status_code == 200
    assert rename_res.json()["icon"]["name"] == "acme-corporate-logo"

    # 5. Delete icon
    del_res = client.delete(f"/api/v1/icons/{icon_id}")
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

    # 6. Verify 404 after deletion
    assert client.get(f"/api/v1/icons/{icon_id}/raw").status_code == 404


def test_hostile_svg_sanitization():
    # A. Script tag injection inside SVG
    script_svg = '<svg><script>alert("XSS")</script><rect width="10" height="10"/></svg>'
    res = client.post("/api/v1/icons", json={"name": "xss-script", "svgContent": script_svg})
    assert res.status_code in (201, 400)
    if res.status_code == 201:
        # If accepted, script tag must be completely stripped
        assert "<script" not in res.json()["icon"]["svg_content"].lower()

    # B. foreignObject with dangerous payload
    foreign_svg = '<svg><foreignObject width="100" height="100"><body xmlns="http://www.w3.org/1999/xhtml"><iframe src="javascript:alert(1)"/></body></foreignObject><rect width="10" height="10"/></svg>'
    res_fo = client.post("/api/v1/icons", json={"name": "xss-foreign", "svgContent": foreign_svg})
    if res_fo.status_code == 201:
        assert "foreignobject" not in res_fo.json()["icon"]["svg_content"].lower()
        assert "iframe" not in res_fo.json()["icon"]["svg_content"].lower()

    # C. Inline event handlers (onload, onerror, onclick)
    event_svg = '<svg onload="alert(1)"><circle cx="10" cy="10" r="5" onclick="fetch(\'http://evil.com\')"/></svg>'
    res_ev = client.post("/api/v1/icons", json={"name": "xss-events", "svgContent": event_svg})
    assert res_ev.status_code == 201
    sanitized = res_ev.json()["icon"]["svg_content"]
    assert "onload" not in sanitized.lower()
    assert "onclick" not in sanitized.lower()
    assert "evil.com" not in sanitized.lower()

    # D. External href and xlink:href references
    href_svg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><image href="http://evil.com/cookie.png"/><use xlink:href="https://evil.com/vector#icon"/><use href="#internal-id"/></svg>'
    res_href = client.post("/api/v1/icons", json={"name": "xss-href", "svgContent": href_svg})
    assert res_href.status_code == 201
    sanitized_href = res_href.json()["icon"]["svg_content"]
    assert "http://evil.com" not in sanitized_href
    assert "https://evil.com" not in sanitized_href
    # Internal # reference is preserved
    assert "#internal-id" in sanitized_href

    # E. Malicious style block with url() or @import
    style_svg = '<svg><style>@import url("http://evil.com/font.css");</style><rect style="fill: url(\'http://evil.com/bg\');" width="10" height="10"/></svg>'
    res_style = client.post("/api/v1/icons", json={"name": "xss-style", "svgContent": style_svg})
    assert res_style.status_code == 201
    sanitized_style = res_style.json()["icon"]["svg_content"]
    assert "@import" not in sanitized_style
    assert "http://evil.com" not in sanitized_style

    # F. XXE / DOCTYPE Entity injection
    xxe_svg = '<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg><text>&xxe;</text></svg>'
    res_xxe = client.post("/api/v1/icons", json={"name": "xxe-test", "svgContent": xxe_svg})
    if res_xxe.status_code == 201:
        assert "<!doctype" not in res_xxe.json()["icon"]["svg_content"].lower()
        assert "etc/passwd" not in res_xxe.json()["icon"]["svg_content"].lower()

    # G. Malformed XML (should reject with 400)
    malformed_svg = '<svg><circle cx="12" cy="12"'
    res_malformed = client.post("/api/v1/icons", json={"name": "malformed", "svgContent": malformed_svg})
    assert res_malformed.status_code == 400

    # H. Oversized payload (> 1MB)
    huge_svg = '<svg>' + ('<rect width="1" height="1"/>' * 50000) + '</svg>'
    res_huge = client.post("/api/v1/icons", json={"name": "huge", "svgContent": huge_svg})
    assert res_huge.status_code == 400
