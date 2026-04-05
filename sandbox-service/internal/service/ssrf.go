package service

import (
	"fmt"
	"net"
	"net/url"
	"strings"
)

func ValidateRepoURL(repoURL string) error {
	if repoURL == "" {
		return fmt.Errorf("repository URL is required")
	}

	u, err := url.Parse(repoURL)
	if err != nil {
		return fmt.Errorf("invalid repository URL: %s", repoURL)
	}

	if !strings.EqualFold(u.Scheme, "https") {
		return fmt.Errorf("only HTTPS repository URLs are allowed, got: %s", u.Scheme)
	}

	host := u.Hostname()
	if host == "" {
		return fmt.Errorf("invalid repository URL: missing host")
	}

	lower := strings.ToLower(host)
	if lower == "localhost" || lower == "host.docker.internal" || strings.HasSuffix(lower, ".internal") {
		return fmt.Errorf("repository URL points to a local address")
	}

	ips, err := net.LookupIP(host)
	if err != nil {
		return fmt.Errorf("cannot resolve repository host: %s", host)
	}

	for _, ip := range ips {
		if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() {
			return fmt.Errorf("repository URL resolves to a private/local address")
		}
	}

	return nil
}
