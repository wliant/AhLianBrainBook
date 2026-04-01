package com.wliant.brainbook.dto;

import jakarta.validation.constraints.NotBlank;

public record ExpandBulletRequest(
        @NotBlank(message = "Bullet ID is required")
        String bulletId
) {
}
