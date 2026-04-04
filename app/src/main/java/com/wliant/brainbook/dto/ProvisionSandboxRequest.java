package com.wliant.brainbook.dto;

import jakarta.validation.constraints.Size;

public record ProvisionSandboxRequest(
        @Size(max = 255, message = "Branch name must be at most 255 characters")
        String branch,

        Boolean shallow
) {
    public String branchOrDefault(String defaultBranch) {
        if (branch != null && !branch.isBlank()) return branch;
        return defaultBranch;
    }

    public boolean isShallow() {
        return shallow == null || shallow;
    }
}
