package com.wliant.brainbook.dto;

public record ReconciliationResult(
        int unchanged,
        int autoUpdated,
        int drifted,
        int orphaned
) {
    public static ReconciliationResult empty() {
        return new ReconciliationResult(0, 0, 0, 0);
    }
}
