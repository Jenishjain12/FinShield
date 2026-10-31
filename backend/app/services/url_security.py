"""URL security: SSRF protection, private-network blocking, URL validation.

Every URL the browser agent navigates to MUST pass through ``validate_url``
before Playwright opens it.  The function blocks:

- Private / reserved IPv4 and IPv6 ranges  (RFC 1918, link-local, loopback)
- ``localhost`` and ``*.localhost``
- Non-HTTP(S) schemes  (``file:``, ``javascript:``, ``data:``, etc.)
- URLs that resolve to a private IP after DNS lookup
- Excessively long URLs  (> 2048 chars)
"""

from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse

# ----------------------------------------------------------------------- #
# Constants
# ----------------------------------------------------------------------- #

MAX_URL_LENGTH = 2048
ALLOWED_SCHEMES = {"http", "https"}

_BLOCKED_HOSTS = {
    "localhost",
    "localhost.localdomain",
    "0.0.0.0",
    "127.0.0.1",
    "::1",
    "[::1]",
}


# ----------------------------------------------------------------------- #
# Helpers
# ----------------------------------------------------------------------- #


def _is_private_ip(addr: str) -> bool:
    """Return True if *addr* resolves to a loopback, private, reserved,
    or link-local address."""
    try:
        ip = ipaddress.ip_address(addr)
    except ValueError:
        return False
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_reserved
        or ip.is_link_local
        or ip.is_multicast
    )


def _resolve_host(host: str) -> list[str]:
    """Resolve *host* via DNS and return all IP strings."""
    try:
        results = socket.getaddrinfo(host, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
        return list({r[4][0] for r in results})
    except (socket.gaierror, OSError):
        return []


# ----------------------------------------------------------------------- #
# Public API
# ----------------------------------------------------------------------- #


def validate_url(url: str, allow_localhost: bool = False) -> str | None:
    """Return ``None`` when the URL is safe to visit.

    Return a human-readable rejection reason otherwise.
    When allow_localhost is True (testbed mode only), local loopback is permitted.
    """
    if not url or not isinstance(url, str):
        return "URL is empty or not a string."

    if len(url) > MAX_URL_LENGTH:
        return f"URL exceeds the {MAX_URL_LENGTH}-character limit."

    try:
        parsed = urlparse(url)
    except Exception:
        return "URL could not be parsed."

    if parsed.scheme not in ALLOWED_SCHEMES:
        return f"Scheme '{parsed.scheme}' is not allowed. Only HTTP and HTTPS are permitted."

    host = parsed.hostname or ""
    if not host:
        return "URL has no hostname."

    # If allow_localhost is True (controlled test environments only), bypass loopback checks
    if allow_localhost and (host.lower() in _BLOCKED_HOSTS or host.lower() == "localhost" or host.startswith("127.")):
        return None

    # Block well-known local hostnames
    if host.lower() in _BLOCKED_HOSTS or host.lower().endswith(".localhost"):
        return "Navigation to localhost or local hostnames is blocked."

    # Block literal private IPs
    if _is_private_ip(host):
        return "Navigation to private or reserved IP addresses is blocked."

    # DNS-resolve and block if *any* resolved IP is private
    resolved = _resolve_host(host)
    if not resolved:
        return f"DNS resolution failed for '{host}'."

    for ip_str in resolved:
        if _is_private_ip(ip_str):
            return f"Host '{host}' resolves to private address {ip_str}. Navigation blocked."

    return None  # safe


def sanitize_url_for_display(url: str, max_length: int = 200) -> str:
    """Truncate a URL for safe display in UI/logs.  Never returns > *max_length* chars."""
    if not url:
        return ""
    if len(url) <= max_length:
        return url
    return url[: max_length - 1] + "…"
