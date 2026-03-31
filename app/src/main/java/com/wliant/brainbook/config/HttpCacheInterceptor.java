package com.wliant.brainbook.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.time.Duration;
import java.util.List;

@Component
public class HttpCacheInterceptor implements HandlerInterceptor {

    private static final List<CacheRule> CACHE_RULES = List.of(
            new CacheRule("/api/settings",
                    CacheControl.maxAge(Duration.ofMinutes(5)).cachePrivate().getHeaderValue()),
            new CacheRule("/api/attachments/",
                    CacheControl.maxAge(Duration.ofDays(1)).cachePrivate().immutable().getHeaderValue()),
            new CacheRule("/api/brains",
                    CacheControl.maxAge(Duration.ofSeconds(60)).cachePrivate().getHeaderValue()),
            new CacheRule("/api/tags",
                    CacheControl.maxAge(Duration.ofSeconds(60)).cachePrivate().getHeaderValue())
    );

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        String method = request.getMethod();

        if (!"GET".equalsIgnoreCase(method) && !"HEAD".equalsIgnoreCase(method)) {
            response.setHeader(HttpHeaders.CACHE_CONTROL, CacheControl.noStore().getHeaderValue());
            return true;
        }

        String path = request.getRequestURI();
        for (CacheRule rule : CACHE_RULES) {
            if (path.startsWith(rule.pathPrefix())) {
                response.setHeader(HttpHeaders.CACHE_CONTROL, rule.cacheControl());
                return true;
            }
        }

        return true;
    }

    private record CacheRule(String pathPrefix, String cacheControl) {}
}
