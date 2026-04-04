package com.wliant.brainbook.config;

import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.LocalDateTime;

@Component
public class TimeProvider {

    private static Clock clock = Clock.systemUTC();

    public TimeProvider(Clock clock) {
        TimeProvider.clock = clock;
    }

    public static LocalDateTime now() {
        return LocalDateTime.now(clock);
    }
}
