package com.wliant.brainbook.dto;

public record PullResponse(
        String newCommit,
        AnchorsAffected anchorsAffected
) {
    public record AnchorsAffected(
            int unchanged,
            int autoUpdated,
            int drifted,
            int orphaned
    ) {
    }
}
