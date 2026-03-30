package com.wliant.brainbook.controller;

import com.wliant.brainbook.dto.BrainStatsResponse;
import com.wliant.brainbook.service.BrainStatsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/brains")
public class BrainStatsController {

    private final BrainStatsService brainStatsService;

    public BrainStatsController(BrainStatsService brainStatsService) {
        this.brainStatsService = brainStatsService;
    }

    @GetMapping("/{id}/stats")
    public BrainStatsResponse getStats(@PathVariable UUID id) {
        return brainStatsService.getStats(id);
    }
}
