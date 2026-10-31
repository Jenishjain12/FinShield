from app.services.url_security import validate_url, sanitize_url_for_display


def test_valid_public_urls():
    assert validate_url("https://www.example.com") is None
    assert validate_url("http://example.org/path/to/page?param=1") is None
    assert validate_url("https://news.ycombinator.com") is None


def test_blocked_localhost_and_loopback():
    assert validate_url("http://localhost:8000") is not None
    assert validate_url("http://127.0.0.1:8080") is not None
    assert validate_url("http://127.0.0.2/") is not None
    assert validate_url("http://test.localhost/") is not None
    assert validate_url("http://0.0.0.0/") is not None


def test_blocked_private_ip_ranges():
    assert validate_url("http://10.0.0.1/admin") is not None
    assert validate_url("http://172.16.5.1/") is not None
    assert validate_url("http://192.168.1.1/") is not None
    assert validate_url("http://169.254.169.254/latest/meta-data/") is not None


def test_blocked_non_http_schemes():
    assert validate_url("file:///etc/passwd") is not None
    assert validate_url("javascript:alert(1)") is not None
    assert validate_url("data:text/html;base64,PHNjcmlwdD4=") is not None
    assert validate_url("ftp://ftp.example.com") is not None


def test_empty_and_excessive_url():
    assert validate_url("") is not None
    assert validate_url("https://" + "a" * 2100 + ".com") is not None


def test_allow_localhost_for_testbed():
    assert validate_url("http://localhost:8000", allow_localhost=True) is None
    assert validate_url("http://127.0.0.1:9000", allow_localhost=True) is None
    # Still blocks private IPs even if allow_localhost is True
    assert validate_url("http://10.0.0.1/", allow_localhost=True) is not None


def test_sanitize_url_for_display():
    assert sanitize_url_for_display("https://example.com") == "https://example.com"
    long_url = "https://example.com/" + "a" * 300
    sanitized = sanitize_url_for_display(long_url, max_length=50)
    assert len(sanitized) <= 50
    assert sanitized.endswith("…")
