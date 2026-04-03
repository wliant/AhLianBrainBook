package com.wliant.brainbook.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.TimeUnit;

@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager cacheManager = new CaffeineCacheManager();
        cacheManager.setCaffeine(Caffeine.newBuilder()
                .maximumSize(500)
                .expireAfterWrite(5, TimeUnit.MINUTES));
        cacheManager.setCacheNames(java.util.List.of(
                "brains", "tags", "settings", "brainStats", "clustersByBrain",
                "githubTree", "githubFile"));

        // Register caches with custom TTLs
        cacheManager.registerCustomCache("settings",
                Caffeine.newBuilder()
                        .maximumSize(1)
                        .expireAfterWrite(10, TimeUnit.MINUTES)
                        .build());
        cacheManager.registerCustomCache("brainStats",
                Caffeine.newBuilder()
                        .maximumSize(50)
                        .expireAfterWrite(2, TimeUnit.MINUTES)
                        .build());
        cacheManager.registerCustomCache("clustersByBrain",
                Caffeine.newBuilder()
                        .maximumSize(200)
                        .expireAfterWrite(2, TimeUnit.MINUTES)
                        .build());

        cacheManager.registerCustomCache("githubTree",
                Caffeine.newBuilder()
                        .maximumSize(200)
                        .expireAfterWrite(1, TimeUnit.MINUTES)
                        .build());
        cacheManager.registerCustomCache("githubFile",
                Caffeine.newBuilder()
                        .maximumSize(500)
                        .expireAfterWrite(5, TimeUnit.MINUTES)
                        .build());

        return cacheManager;
    }
}
