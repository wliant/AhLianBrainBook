package com.wliant.brainbook;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class BrainBookApplication {

    public static void main(String[] args) {
        SpringApplication.run(BrainBookApplication.class, args);
    }
}
