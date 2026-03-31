package com.wliant.brainbook.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebCacheConfig implements WebMvcConfigurer {

    private final HttpCacheInterceptor httpCacheInterceptor;

    public WebCacheConfig(HttpCacheInterceptor httpCacheInterceptor) {
        this.httpCacheInterceptor = httpCacheInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(httpCacheInterceptor).addPathPatterns("/api/**");
    }
}
