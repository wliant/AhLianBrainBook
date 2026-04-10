package com.wliant.brainbook.config;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Component;

import java.util.concurrent.Executor;

@Component
public class DatabaseCleaner {

    private final JdbcTemplate jdbcTemplate;
    private final Executor aiTaskExecutor;

    public DatabaseCleaner(JdbcTemplate jdbcTemplate,
                           @Qualifier("aiTaskExecutor") Executor aiTaskExecutor) {
        this.jdbcTemplate = jdbcTemplate;
        this.aiTaskExecutor = aiTaskExecutor;
    }

    public void clean() {
        drainAsyncTasks();
        jdbcTemplate.execute("TRUNCATE TABLE neuron_shares CASCADE");
        jdbcTemplate.execute("TRUNCATE TABLE todo_metadata CASCADE");
        jdbcTemplate.execute("TRUNCATE TABLE link_suggestions CASCADE");
        jdbcTemplate.execute("TRUNCATE TABLE neuron_embeddings CASCADE");
        jdbcTemplate.execute("TRUNCATE TABLE neuron_anchors CASCADE");
        jdbcTemplate.execute("TRUNCATE TABLE research_topics CASCADE");
        jdbcTemplate.execute("TRUNCATE TABLE spaced_repetition_items CASCADE");
        jdbcTemplate.execute("TRUNCATE TABLE brains CASCADE");
        jdbcTemplate.execute("TRUNCATE TABLE tags CASCADE");
        jdbcTemplate.execute("TRUNCATE TABLE templates CASCADE");
        jdbcTemplate.execute("TRUNCATE TABLE thoughts CASCADE");
        // Reset app_settings singleton to defaults (do NOT truncate — seeded by Flyway)
        jdbcTemplate.execute("UPDATE app_settings SET display_name = 'user', max_reminders_per_neuron = 10, timezone = 'Asia/Singapore', ai_tools_enabled = false");
    }

    public void drainAsyncTasks() {
        if (aiTaskExecutor instanceof ThreadPoolTaskExecutor pool) {
            // Brief pause to let post-commit callbacks enqueue their async tasks
            try { Thread.sleep(200); } catch (InterruptedException ignored) {}
            long deadline = System.currentTimeMillis() + 10000;
            while (pool.getThreadPoolExecutor().getActiveCount() > 0
                    || !pool.getThreadPoolExecutor().getQueue().isEmpty()) {
                if (System.currentTimeMillis() > deadline) break;
                try { Thread.sleep(50); } catch (InterruptedException e) { break; }
            }
        }
    }
}
