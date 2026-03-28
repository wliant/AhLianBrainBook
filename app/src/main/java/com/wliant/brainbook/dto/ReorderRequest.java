package com.wliant.brainbook.dto;

import java.util.List;
import java.util.UUID;

public record ReorderRequest(
        List<UUID> orderedIds
) {
}
