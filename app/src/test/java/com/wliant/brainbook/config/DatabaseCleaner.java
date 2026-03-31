package com.wliant.brainbook.config;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class DatabaseCleaner {

    private final JdbcTemplate jdbcTemplate;

    public DatabaseCleaner(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void clean() {
        jdbcTemplate.execute("TRUNCATE TABLE spaced_repetition_items CASCADE");
        jdbcTemplate.execute("TRUNCATE TABLE brains CASCADE");
        jdbcTemplate.execute("TRUNCATE TABLE tags CASCADE");
        jdbcTemplate.execute("TRUNCATE TABLE templates CASCADE");
    }
}
